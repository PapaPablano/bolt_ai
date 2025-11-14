import { useState } from 'react';
import { Modal } from './Modal';
import { LiveRegion } from './LiveRegion';
import { DynamicContentUpdate } from './DynamicContentUpdate';
import { useAutoFocus, useKeyboardNavigation, useAnnouncement } from '../hooks/useFocusManagement';

export function FocusManagementDemo() {
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState(['Item 1', 'Item 2', 'Item 3']);
  const [statusMessage, setStatusMessage] = useState('');
  const [newItem, setNewItem] = useState('');

  const inputRef = useAutoFocus<HTMLInputElement>(true);
  const announce = useAnnouncement();

  useKeyboardNavigation(
    () => setShowModal(false),
    undefined,
    showModal
  );

  const handleAddItem = () => {
    if (newItem.trim()) {
      const updatedItems = [...items, newItem];
      setItems(updatedItems);
      setStatusMessage(`Added ${newItem}. Total items: ${updatedItems.length}`);
      announce(`${newItem} added to list`, 'polite');
      setNewItem('');
    }
  };

  const handleRemoveItem = (index: number) => {
    const removedItem = items[index];
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    setStatusMessage(`Removed ${removedItem}. Total items: ${updatedItems.length}`);
    announce(`${removedItem} removed from list`, 'polite');
  };

  const handleOpenModal = () => {
    setShowModal(true);
    announce('Settings dialog opened', 'assertive');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    announce('Settings dialog closed', 'polite');
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-100">
        Focus Management Demo
      </h1>

      <section className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">
          1. Skip Links
        </h2>
        <p className="text-slate-400">
          Press Tab when the page loads to see skip links that allow jumping to main content areas.
          Skip links are WCAG 2.1 SC 2.4.1 compliant.
        </p>
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">
          2. Modal Focus Trap
        </h2>
        <p className="text-slate-400">
          Open the modal to experience automatic focus trapping. Focus is saved before opening
          and restored when closing. Press Escape to close.
        </p>
        <button
          onClick={handleOpenModal}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Open Modal
        </button>
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">
          3. Dynamic Content Updates
        </h2>
        <p className="text-slate-400">
          Add or remove items to experience screen reader announcements when content updates.
          Changes are announced via ARIA live regions.
        </p>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder="Enter new item"
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="New item name"
          />
          <button
            onClick={handleAddItem}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            aria-label="Add item to list"
          >
            Add Item
          </button>
        </div>

        <DynamicContentUpdate
          updateMessage={statusMessage}
          shouldAnnounce={false}
        >
          <ul className="space-y-2" role="list" aria-label="Items list">
            {items.map((item, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 rounded-lg"
              >
                <span className="text-slate-200">{item}</span>
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  aria-label={`Remove ${item}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </DynamicContentUpdate>

        <LiveRegion message={statusMessage} priority="polite" />
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">
          4. Keyboard Navigation
        </h2>
        <div className="space-y-2 text-slate-400">
          <p><kbd className="px-2 py-1 bg-slate-900 border border-slate-700 rounded">Tab</kbd> - Navigate forward through focusable elements</p>
          <p><kbd className="px-2 py-1 bg-slate-900 border border-slate-700 rounded">Shift + Tab</kbd> - Navigate backward through focusable elements</p>
          <p><kbd className="px-2 py-1 bg-slate-900 border border-slate-700 rounded">Enter</kbd> - Activate buttons and links</p>
          <p><kbd className="px-2 py-1 bg-slate-900 border border-slate-700 rounded">Escape</kbd> - Close modals and dialogs</p>
          <p><kbd className="px-2 py-1 bg-slate-900 border border-slate-700 rounded">Space</kbd> - Toggle checkboxes and activate buttons</p>
        </div>
      </section>

      <section className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-slate-200">
          5. WCAG 2.1 Compliance
        </h2>
        <ul className="space-y-2 text-slate-400 list-disc list-inside">
          <li><strong>SC 2.4.1:</strong> Bypass Blocks - Skip links implemented</li>
          <li><strong>SC 2.4.3:</strong> Focus Order - Logical tab order maintained</li>
          <li><strong>SC 2.4.7:</strong> Focus Visible - Clear focus indicators on all interactive elements</li>
          <li><strong>SC 3.2.1:</strong> On Focus - No unexpected context changes</li>
          <li><strong>SC 4.1.3:</strong> Status Messages - ARIA live regions for dynamic content</li>
        </ul>
      </section>

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={handleCloseModal}
          title="Settings"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-slate-300">
              This modal demonstrates focus management. Try pressing Tab to navigate
              within the modal. Focus is trapped inside until you close it.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                Enable notifications
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                Auto-save changes
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
