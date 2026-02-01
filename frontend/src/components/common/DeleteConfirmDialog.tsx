/**
 * DeleteConfirmDialog Component
 * 
 * Confirmation dialog for delete operations.
 * Uses a destructive action pattern with clear warnings.
 */

import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  itemName?: string;
  itemType?: string;
  message?: string;
  warningMessage?: string;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Delete',
  itemName,
  itemType = 'item',
  message,
  warningMessage,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setError(null);
      onClose();
    }
  };

  const displayMessage = message || (
    itemName 
      ? `Are you sure you want to delete "${itemName}"?`
      : `Are you sure you want to delete this ${itemType}?`
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        {/* Warning Icon */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-gray-700">{displayMessage}</p>
          
          {warningMessage && (
            <p className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
              {warningMessage}
            </p>
          )}
          
          <p className="mt-2 text-sm text-gray-500">
            This action can be undone by an administrator if needed.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={18} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteConfirmDialog;
