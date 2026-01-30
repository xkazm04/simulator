/**
 * ModalProvider - Root-level modal management to avoid z-index/layering issues
 *
 * Renders modals via createPortal directly to document.body, outside of any
 * parent containers with overflow:hidden or transform properties.
 *
 * Usage:
 * 1. Wrap your app with <ModalProvider>
 * 2. Use useModal() hook to open/close modals from any component
 * 3. Modals render via portal to document.body
 */

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';

// Modal registration type
export interface ModalConfig {
  id: string;
  content: ReactNode;
  /** Optional callback when modal is closed externally */
  onClose?: () => void;
}

export interface ModalContextValue {
  /** Open a modal with given id and content */
  openModal: (config: ModalConfig) => void;
  /** Close a modal by id */
  closeModal: (id: string) => void;
  /** Close all open modals */
  closeAllModals: () => void;
  /** Check if a modal is currently open */
  isModalOpen: (id: string) => boolean;
  /** Get list of open modal ids */
  openModalIds: string[];
}

const ModalContext = createContext<ModalContextValue | null>(null);

export interface ModalProviderProps {
  children: ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modals, setModals] = useState<Map<string, ModalConfig>>(new Map());
  const [mounted, setMounted] = useState(false);

  // Track client-side mount for portal (SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  const openModal = useCallback((config: ModalConfig) => {
    setModals((prev) => {
      const next = new Map(prev);
      next.set(config.id, config);
      return next;
    });
  }, []);

  const closeModal = useCallback((id: string) => {
    setModals((prev) => {
      const modal = prev.get(id);
      if (modal?.onClose) {
        modal.onClose();
      }
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModals((prev) => {
      prev.forEach((modal) => {
        if (modal.onClose) {
          modal.onClose();
        }
      });
      return new Map();
    });
  }, []);

  const isModalOpen = useCallback(
    (id: string) => modals.has(id),
    [modals]
  );

  const openModalIds = useMemo(() => Array.from(modals.keys()), [modals]);

  const value = useMemo(
    () => ({
      openModal,
      closeModal,
      closeAllModals,
      isModalOpen,
      openModalIds,
    }),
    [openModal, closeModal, closeAllModals, isModalOpen, openModalIds]
  );

  // Render modal contents
  const modalContents = useMemo(
    () => Array.from(modals.values()).map((modal) => (
      <React.Fragment key={modal.id}>{modal.content}</React.Fragment>
    )),
    [modals]
  );

  // Portal content - renders directly to document.body
  const portalContent = mounted && modalContents.length > 0 ? (
    createPortal(
      <AnimatePresence mode="sync">
        {modalContents}
      </AnimatePresence>,
      document.body
    )
  ) : null;

  return (
    <ModalContext.Provider value={value}>
      {children}
      {portalContent}
    </ModalContext.Provider>
  );
}

/**
 * Hook to access modal context
 */
export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

/**
 * Hook to manage a specific modal instance
 * Provides convenient open/close for a single modal
 */
export function useModalInstance(modalId: string) {
  const { openModal, closeModal, isModalOpen } = useModal();

  const open = useCallback(
    (content: ReactNode, onClose?: () => void) => {
      openModal({ id: modalId, content, onClose });
    },
    [modalId, openModal]
  );

  const close = useCallback(() => {
    closeModal(modalId);
  }, [modalId, closeModal]);

  const isOpen = isModalOpen(modalId);

  return { open, close, isOpen };
}
