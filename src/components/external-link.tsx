import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';

/**
 * Props for {@link ExternalLink}.
 *
 * `href` must be a string URL accepted by `expo-router`'s `Link` type.
 */
export type ExternalLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  /**
   * Fully-qualified URL to open in a browser.
   *
   * On native platforms, the app uses an in-app browser to avoid switching
   * away from the app.
   */
  href: Href & string;
};

/**
 * External link wrapper around `expo-router`'s {@link Link}.
 *
 * Behavior:
 * - On web: falls back to normal link navigation (target `_blank`).
 * - On iOS/Android: prevents default browser behavior and opens the link
 *   using `expo-web-browser`.
 */
export function ExternalLink({ href, ...rest }: ExternalLinkProps) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
