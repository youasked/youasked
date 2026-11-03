import { PageHead } from "./Page";

export function NotFoundPage() {
  return (
    <PageHead
      eyebrow="404"
      title="That page isn't here"
      lede={
        <>
          It may have moved, or the board you wanted isn't public. Try the <a href="/">home page</a>, the <a href="/docs">docs</a> or <a href="/pricing">pricing</a>.
        </>
      }
    />
  );
}
