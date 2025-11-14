import { useEffect, useState } from 'react';

export function FocusIndicator() {
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
        setIsFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
      setIsFocusVisible(false);
    };

    const handleFocusIn = () => {
      if (isKeyboardUser) {
        setIsFocusVisible(true);
      }
    };

    const handleFocusOut = () => {
      setIsFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isKeyboardUser]);

  useEffect(() => {
    if (isFocusVisible) {
      document.body.classList.add('keyboard-focus');
    } else {
      document.body.classList.remove('keyboard-focus');
    }
  }, [isFocusVisible]);

  return null;
}
