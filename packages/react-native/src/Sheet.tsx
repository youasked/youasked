import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { DragContext, useInternal } from "./context";
import { loadSafeArea } from "./platform";
import { useNative } from "./ui";

type Insets = { top: number; bottom: number; left: number; right: number };
const NoInsets = createContext<Insets | null>(null);

/** Safe-area insets from react-native-safe-area-context when the app has it, else a sensible estimate. */
export function useInsets(): Insets {
  const sa = loadSafeArea();
  const real = useContext(sa?.SafeAreaInsetsContext ?? NoInsets);
  const { width, height } = useWindowDimensions();
  if (real) return real;
  if (Platform.OS === "ios") {
    const notched = Math.max(width, height) >= 812 && Math.min(width, height) < 700;
    return { top: notched ? 47 : 20, bottom: notched && height > width ? 34 : 0, left: 0, right: 0 };
  }
  return { top: StatusBar.currentHeight ?? 24, bottom: 0, left: 0, right: 0 };
}

/**
 * How far to lift the sheet for the keyboard, and the keyboard's height (0 when it's down). On iOS the
 * window doesn't move, so lift by the keyboard's height. On Android the window may already have shrunk
 * (adjustResize), so only lift by what's left; `baseline` is the full height measured while the
 * keyboard was down.
 */
function useKeyboardPad(rootHeight: number, baseline: MutableRefObject<number>): [number, number] {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      if (ios) LayoutAnimation.configureNext({ duration: e.duration || 250, update: { type: "keyboard" } });
      setKb(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (e) => {
      if (ios) LayoutAnimation.configureNext({ duration: e.duration || 250, update: { type: "keyboard" } });
      setKb(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (kb === 0) return [0, 0];
  const shrunk = Math.max(0, baseline.current - rootHeight);
  return [Math.max(0, kb - shrunk), kb];
}

export function Sheet({
  active,
  onClosed,
  dismissRef,
  children,
}: {
  /** True while a route is open. The sheet animates away before `onClosed` fires. */
  active: boolean;
  onClosed: () => void;
  dismissRef: MutableRefObject<(() => void) | null>;
  children: ReactNode;
}) {
  const { styles: s } = useInternal();
  const { height: winH } = useWindowDimensions();
  const insets = useInsets();
  const sheetH = Math.min(winH * 0.9, 760);
  const ty = useRef(new Animated.Value(winH)).current;
  const [mounted, setMounted] = useState(false);
  const closing = useRef(false);
  const [rootH, setRootH] = useState(0);
  const baseline = useRef(0);
  const [pad, keyboard] = useKeyboardPad(rootH, baseline);
  const keyboardRef = useRef(0);
  keyboardRef.current = keyboard;

  useEffect(() => {
    if (active && !mounted) {
      closing.current = false;
      ty.setValue(winH);
      setMounted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!mounted) return;
    Animated.timing(ty, { toValue: 0, duration: 340, easing: Easing.bezier(0.2, 0.9, 0.25, 1), useNativeDriver: useNative }).start();
  }, [mounted, ty]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    Animated.timing(ty, { toValue: winH, duration: 230, easing: Easing.in(Easing.cubic), useNativeDriver: useNative }).start(() => {
      setMounted(false);
      onClosed();
    });
  }, [ty, winH, onClosed]);
  dismissRef.current = dismiss;

  // Swipe down on the handle or header to dismiss; a small flick or a quarter of the height is enough.
  // The handle claims the touch as soon as it starts (on Android's new architecture a view that only
  // asks on move never gets the gesture). The header has buttons, so it only takes over once the
  // finger is clearly moving down, using the capture phase so a button under the finger can't keep it.
  const { grab, header } = useMemo(() => {
    const settle = () =>
      Animated.spring(ty, { toValue: 0, bounciness: 4, speed: 16, useNativeDriver: useNative }).start();
    const downward = (g: { dy: number; dx: number }) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2;
    const handlers = {
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => ty.stopAnimation(),
      onPanResponderMove: (_: unknown, g: { dy: number }) => ty.setValue(g.dy < 0 ? Math.max(-18, g.dy * 0.2) : g.dy),
      onPanResponderRelease: (_: unknown, g: { dy: number; vy: number }) => (g.dy > sheetH * 0.25 || g.vy > 0.5 ? dismiss() : settle()),
      onPanResponderTerminate: settle,
    };
    return {
      grab: PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: (_, g) => downward(g), ...handlers }),
      header: PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => downward(g),
        onMoveShouldSetPanResponderCapture: (_, g) => downward(g),
        ...handlers,
      }),
    };
  }, [ty, sheetH, dismiss]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setRootH(h);
    // Only while the keyboard is down: with it up, a shrunk window would look like the full height and
    // the sheet would lift twice, leaving a see-through gap above the keyboard on Android.
    if (keyboardRef.current === 0) baseline.current = h;
  };

  const bottomInset = pad > 0 ? 0 : insets.bottom;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View style={s.sheetRoot} onLayout={onLayout}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Close" accessibilityRole="button">
          <Animated.View
            style={[s.backdrop, { opacity: ty.interpolate({ inputRange: [0, sheetH], outputRange: [1, 0], extrapolate: "clamp" }) }]}
          />
        </Pressable>
        <View
          style={{ width: "100%", flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: pad, paddingTop: insets.top + 8 }}
          pointerEvents="box-none"
        >
          <Animated.View
            accessibilityViewIsModal
            style={[s.sheet, { height: sheetH, maxHeight: "100%", paddingBottom: bottomInset, transform: [{ translateY: ty }] }]}
          >
            <View {...grab.panHandlers} style={s.grabZone} collapsable={false}>
              <View style={s.grab} />
            </View>
            <DragContext.Provider value={header.panHandlers as unknown as Record<string, unknown>}>
              <View style={{ flex: 1 }}>{children}</View>
            </DragContext.Provider>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
