import { describe, it, expect, beforeEach } from 'vitest';

describe('LG webOS Premium Exit Confirmation Dialog', () => {
  let showExitDialog;
  let focusedId;
  let exitCallbackCalled;

  beforeEach(() => {
    showExitDialog = false;
    focusedId = 'nav-home';
    exitCallbackCalled = false;
  });

  const handleExitApp = () => {
    exitCallbackCalled = true;
  };

  const handleKeyDown = (e) => {
    // Intercept Back remote keys
    if (
      e.key === 'Escape' ||
      e.key === 'Backspace' ||
      e.key === 'BrowserBack' ||
      e.keyCode === 461
    ) {
      if (showExitDialog) {
        showExitDialog = false;
        focusedId = 'nav-home';
      } else {
        showExitDialog = true;
        focusedId = 'exit-cancel'; // Auto-focus Cancel button
      }
    } else if (showExitDialog) {
      // While exit dialog is active, ArrowLeft/ArrowRight toggle focus
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        focusedId = focusedId === 'exit-exit' ? 'exit-cancel' : 'exit-exit';
      } else if (e.key === 'Enter') {
        if (focusedId === 'exit-exit') {
          handleExitApp();
        } else {
          showExitDialog = false;
          focusedId = 'nav-home';
        }
      }
    }
  };

  it('should toggle exit dialog visibility and auto-focus cancel button on Back key press', () => {
    expect(showExitDialog).toBe(false);
    expect(focusedId).toBe('nav-home');

    // Simulate D-pad Back Remote Key (keycode 461)
    handleKeyDown({ key: 'BrowserBack', keyCode: 461 });

    expect(showExitDialog).toBe(true);
    expect(focusedId).toBe('exit-cancel');
  });

  it('should dismiss the dialog when pressing Back remote key while the dialog is open', () => {
    showExitDialog = true;
    focusedId = 'exit-cancel';

    // Press Back key again
    handleKeyDown({ key: 'BrowserBack', keyCode: 461 });

    expect(showExitDialog).toBe(false);
    expect(focusedId).toBe('nav-home');
  });

  it('should toggle spatial focus horizontally between Cancel and Exit on D-pad Arrow clicks', () => {
    showExitDialog = true;
    focusedId = 'exit-cancel';

    // Press ArrowRight
    handleKeyDown({ key: 'ArrowRight' });
    expect(focusedId).toBe('exit-exit');

    // Press ArrowLeft
    handleKeyDown({ key: 'ArrowLeft' });
    expect(focusedId).toBe('exit-cancel');
  });

  it('should close the dialog when selecting Cancel and pressing Enter', () => {
    showExitDialog = true;
    focusedId = 'exit-cancel';

    // Press Enter
    handleKeyDown({ key: 'Enter' });

    expect(showExitDialog).toBe(false);
    expect(focusedId).toBe('nav-home');
    expect(exitCallbackCalled).toBe(false);
  });

  it('should close/terminate the webOS application when selecting Exit and pressing Enter', () => {
    showExitDialog = true;
    focusedId = 'exit-exit';

    // Press Enter
    handleKeyDown({ key: 'Enter' });

    expect(exitCallbackCalled).toBe(true);
  });
});
