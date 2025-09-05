// Placeholder for actual Factory SDK
// In a real implementation, this would be: import { ui } from '@factory/sdk';
/**
 * UI message primitives expected by (mocked) Factory SDK
 * Only the shapes required by this demo are modelled here.
 */
interface UiTagMessage {
  type: 'tag';
  label: string;
  href: string;
  variant: string;
}

interface UiTextMessage {
  type: 'text';
  text: string;
}

type UiMessage = UiTagMessage | UiTextMessage;

const ui = {
  sendMessage: (messages: UiMessage[]): void => {
    // eslint-disable-next-line no-console -- Demo shim just logs to console
    console.log('Factory SDK message:', messages);
  },
  renderTag: ({ label, href, variant }: Omit<UiTagMessage, 'type'>): UiTagMessage => ({
    type: 'tag',
    label,
    href,
    variant
  })
};

export const CODE_DROID_URL = '/new?persona=code-droid&via=tutorial';

/**
 * Detects if a message contains keywords indicating real work requests
 * @param message The user message to check
 * @returns True if the message appears to be asking for real work
 */
export function isRealWork(message: string) {
  return /migrate|auth|billing|db|production|deploy|feature[-]flag|refactor/i.test(message);
}

/**
 * Redirects the user to Code Droid for real development work
 */
export function sendCodeDroidRedirect() {
  ui.sendMessage([
    ui.renderTag({ label: 'Open Code Droid', href: CODE_DROID_URL, variant: 'action' }),
    { type: 'text', text: 'This session is a quick demo. Let\'s switch over so we can work on your real code!' }
  ]);
}
