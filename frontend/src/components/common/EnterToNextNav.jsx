import { useEffect } from 'react';

/**
 * Global "Enter = Go to next field" keyboard navigation.
 *
 * Makes data entry behave like a classic ERP / spreadsheet grid:
 *   • Pressing Enter inside a text/number/date field moves focus to the next
 *     editable field in the same "<form>", instead of submitting the form.
 *   • Inside a <select>, start typing to jump to a matching option (native
 *     type-ahead), then press Enter to confirm and move to the next field.
 *   • Pressing Enter on the LAST editable field submits the form (so Save
 *     buttons still work, and login/search forms keep working).
 *   • TAB keeps its normal behaviour; SHIFT works like shift+Tab.
 *
 * Safety guards (native behaviour is preserved for these):
 *   • <textarea>  -> Enter inserts a new line (multiline input stays safe).
 *   • type="search", role="searchbox"/"combobox", aria-autocomplete -> left alone.
 *   • Any control inside `[data-enter-submit="true"]` -> left alone
 *     (used by search/scan/command-palette inputs that already handle Enter).
 *   • Controls NOT inside a <form> or [data-enter-group] -> left alone
 *     (toolbar search boxes, POS scanner fields, etc. keep their own behaviour).
 */
export default function EnterToNextNav() {
  useEffect(() => {
    const lastType = { t: 0 };

    const FOCUSABLE_SELECTOR =
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])';

    const isEditableControl = (el) => {
      if (!el || !el.tagName) return false;
      if (el.tagName === 'SELECT') return true;
      if (el.tagName === 'TEXTAREA') return true;
      if (el.tagName === 'INPUT') {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        return ![
          'submit', 'button', 'reset', 'checkbox', 'radio', 'hidden',
          'range', 'file', 'image', 'color',
        ].includes(t);
      }
      return false;
    };

    const isVisible = (el) => {
      if (el.disabled || el.readOnly) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const skipEnter = (el) => {
      if (el.tagName === 'TEXTAREA') return true; // Enter = new line
      if ((el.getAttribute('type') || 'text').toLowerCase() === 'search') return true;
      const role = el.getAttribute('role');
      if (role === 'searchbox' || role === 'combobox') return true;
      if (el.hasAttribute('aria-autocomplete')) return true;
      // Respect explicit opt-out (search / scan / command-palette inputs).
      if (el.closest('[data-enter-submit="true"]')) return true;
      return false;
    };

    const getEditableControls = (container) => {
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(isEditableControl)
        .filter(isVisible);
    };

    const submitForm = (form) => {
      try {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else if (form.submit) {
          form.submit();
        }
      } catch (_) {
        /* ignore invalid-form / not-submittable errors */
      }
    };

    const handleKeyDown = (e) => {
      const target = e.target;

      // Record select type-ahead activity (a printable key typed on a <select>).
      if (
        target && target.tagName === 'SELECT' &&
        e.key && e.key.length === 1 &&
        !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        lastType.t = Date.now();
      }

      if (e.key !== 'Enter') return;

      if (!target || !target.tagName) return;
      if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;

      // Let shortcuts (Ctrl/Alt/Meta/Shift+Enter) pass through untouched.
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

      if (skipEnter(target)) return;

      // For a <select>, only treat Enter as "confirm + next" when the user just
      // did type-ahead (typed a letter recently). Otherwise let the browser
      // open / confirm the native dropdown.
      if (target.tagName === 'SELECT') {
        if (Date.now() - lastType.t >= 1200) return;
      }

      // Scope to the nearest <form> or an opted-in container only. This keeps
      // toolbar searches & standalone inputs (e.g. POS scanners) untouched.
      const container =
        target.closest('form') || target.closest('[data-enter-group]');
      if (!container) return;

      const controls = getEditableControls(container);
      const idx = controls.indexOf(target);
      if (idx === -1) return;

      const next = controls[idx + 1];
      if (!next) {
        // Last editable field -> let the form submit naturally.
        if (target.closest('form')) {
          e.preventDefault();
          e.stopPropagation();
          submitForm(target.closest('form'));
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      next.focus();
      if (next.tagName === 'INPUT') {
        next.select && next.select();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // This component renders nothing.
  return null;
}