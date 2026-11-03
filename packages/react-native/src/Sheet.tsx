import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Animated,
  BackHandler,
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
    const notched =
      Math.max(width, height) >= 812 && Math.min(width, height) < 700;
    return {
      top: notched ? 47 : 20,
      bottom: notched && height > width ? 34 : 0,
      left: 0,
      right: 0,
    };
  }
  return { top: StatusBar.currentHeight ?? 24, bottom: 0, left: 0, right: 0 };
}

/**
 * How far to lift the sheet so it sits right on the keyboard: how much the keyboard's top edge
 * overlaps the sheet's root, re-measured whenever the root's layout changes. The keyboard's reported
 * height isn't used: on edge-to-edge Android it doesn't match what's on screen.
 *
 * On Android, measureInWindow counts from the bottom of the status bar while the keyboard's screenY
 * counts from the top of the screen, so the status bar height is taken off the keyboard's edge.
 */
function useKeyboardPad(rootRef: RefObject<View | null>): [number, () => void] {
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [fallback, setFallback] = useState(0);
  const [rootBottom, setRootBottom] = useState(0);
  const remeasure = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y, _w, h) => setRootBottom(y + h));
  }, [rootRef]);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(
      ios ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        if (ios)
          LayoutAnimation.configureNext({
            duration: e.duration || 250,
            update: { type: "keyboard" },
          });
        const top = e.endCoordinates.screenY;
        if (top > 0) setKeyboardTop(top);
        else setFallback(e.endCoordinates.height);
        remeasure();
      },
    );
    const hide = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      (e) => {
        if (ios)
          LayoutAnimation.configureNext({
            duration: e.duration || 250,
            update: { type: "keyboard" },
          });
        setKeyboardTop(null);
        setFallback(0);
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [remeasure]);
  const frameTop = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
  const pad =
    keyboardTop === null
      ? fallback
      : rootBottom > 0
        ? Math.max(0, Math.round(rootBottom - (keyboardTop - frameTop)))
        : 0;
  useEffect(() => {
    if (__DEV__ && Platform.OS === "android" && keyboardTop !== null) {
      console.log(
        `[YouAsked] keyboard top ${Math.round(keyboardTop)}, status bar ${frameTop}, root bottom ${Math.round(rootBottom)}, lift ${pad}`,
      );
    }
  }, [keyboardTop, rootBottom, pad, frameTop]);
  return [pad, remeasure];
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
  const rootRef = useRef<View>(null);
  const [pad, remeasureRoot] = useKeyboardPad(rootRef);

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
    Animated.timing(ty, {
      toValue: 0,
      duration: 340,
      easing: Easing.bezier(0.2, 0.9, 0.25, 1),
      useNativeDriver: useNative,
    }).start();
  }, [mounted, ty]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    Animated.timing(ty, {
      toValue: winH,
      duration: 230,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: useNative,
    }).start(() => {
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
      Animated.spring(ty, {
        toValue: 0,
        bounciness: 4,
        speed: 16,
        useNativeDriver: useNative,
      }).start();
    const downward = (g: { dy: number; dx: number }) =>
      g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2;
    const handlers = {
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => ty.stopAnimation(),
      onPanResponderMove: (_: unknown, g: { dy: number }) =>
        ty.setValue(g.dy < 0 ? Math.max(-18, g.dy * 0.2) : g.dy),
      onPanResponderRelease: (_: unknown, g: { dy: number; vy: number }) =>
        g.dy > sheetH * 0.25 || g.vy > 0.5 ? dismiss() : settle(),
      onPanResponderTerminate: settle,
    };
    return {
      grab: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => downward(g),
        ...handlers,
      }),
      header: PanResponder.create({
        // Buttons in the header claim their own taps first; anywhere else on the header starts a drag.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => downward(g),
        onMoveShouldSetPanResponderCapture: (_, g) => downward(g),
        ...handlers,
      }),
    };
  }, [ty, sheetH, dismiss]);

  const bottomInset = pad > 0 ? 0 : insets.bottom;

  // On Android the sheet is drawn inside the app's own window rather than a Modal. A Modal is a
  // separate Android window, and when the keyboard opens Android pans that whole window up to reveal
  // the text field, on top of our own lift, leaving a see-through gap above the keyboard. In the app's
  // window nothing moves on its own, so the measured lift is the only one. Back is handled here instead.
  const overlay = Platform.OS === "android";
  useEffect(() => {
    if (!overlay || !mounted) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [overlay, mounted, dismiss]);

  const body = (
    <View
      style={s.sheetRoot}
      ref={rootRef}
      collapsable={false}
      onLayout={remeasureRoot}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
        accessibilityLabel="Close"
        accessibilityRole="button"
      >
        <Animated.View
          style={[
            s.backdrop,
            {
              opacity: ty.interpolate({
                inputRange: [0, sheetH],
                outputRange: [1, 0],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      </Pressable>
      <View
        style={{
          width: "100%",
          flex: 1,
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: pad,
          paddingTop: insets.top + 8,
        }}
        pointerEvents="box-none"
      >
        <Animated.View
          accessibilityViewIsModal
          style={[
            s.sheet,
            {
              // Shrinks to fit above the keyboard. With only maxHeight, Yoga still places it by its
              // full height, which pushed it up by the difference and left a gap over the keyboard.
              height: sheetH,
              maxHeight: "100%",
              flexShrink: 1,
              paddingBottom: bottomInset,
              transform: [{ translateY: ty }],
            },
          ]}
        >
          <View {...grab.panHandlers} style={s.grabZone} collapsable={false}>
            <View style={s.grab} />
          </View>
          <DragContext.Provider
            value={header.panHandlers as unknown as Record<string, unknown>}
          >
            <View style={{ flex: 1 }}>{children}</View>
          </DragContext.Provider>
        </Animated.View>
      </View>
    </View>
  );

  if (overlay) {
    return mounted ? (
      <View
        style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}
        pointerEvents="box-none"
      >
        {body}
      </View>
    ) : null;
  }
  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
      supportedOrientations={["portrait", "landscape"]}
    >
      {body}
    </Modal>
  );
}
