/**
 * useResponsivePanels - Hook for managing responsive panel collapse states
 *
 * On smaller screens (xl and below), panels start collapsed by default.
 * Prompt sections auto-expand when images are generated.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// Tailwind 'xl' breakpoint is 1280px
// We want to collapse panels on 'xl' and smaller
const XL_BREAKPOINT = 1280;

interface ResponsivePanelState {
  /** Whether sidebars (dimension columns) are expanded */
  sidebarsExpanded: boolean;
  /** Whether top prompt section is expanded */
  topBarExpanded: boolean;
  /** Whether bottom prompt section is expanded */
  bottomBarExpanded: boolean;
  /** Toggle sidebar expansion */
  toggleSidebars: () => void;
  /** Toggle top bar expansion */
  toggleTopBar: () => void;
  /** Toggle bottom bar expansion */
  toggleBottomBar: () => void;
  /** Set sidebar expansion state */
  setSidebarsExpanded: (expanded: boolean) => void;
  /** Set top bar expansion state */
  setTopBarExpanded: (expanded: boolean) => void;
  /** Set bottom bar expansion state */
  setBottomBarExpanded: (expanded: boolean) => void;
  /** Expand both prompt bars (used when images are generated) */
  expandPromptBars: () => void;
  /** Whether we're on a small screen (xl or smaller) */
  isSmallScreen: boolean;
}

export function useResponsivePanels(): ResponsivePanelState {
  // Detect if we're on a small screen
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Panel states - initialize collapsed by default
  // Top/bottom bars always start collapsed, expand on generation
  const [topBarExpanded, setTopBarExpanded] = useState(false);
  const [bottomBarExpanded, setBottomBarExpanded] = useState(false);
  // Sidebars start collapsed on ALL screen sizes by default
  const [sidebarsExpanded, setSidebarsExpanded] = useState(false);

  // Detect screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth <= XL_BREAKPOINT;
      setIsSmallScreen(isSmall);
    };

    // Check immediately
    checkScreenSize();

    // Listen for resize
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleSidebars = useCallback(() => {
    setSidebarsExpanded(prev => !prev);
  }, []);

  const toggleTopBar = useCallback(() => {
    setTopBarExpanded(prev => !prev);
  }, []);

  const toggleBottomBar = useCallback(() => {
    setBottomBarExpanded(prev => !prev);
  }, []);

  const expandPromptBars = useCallback(() => {
    setTopBarExpanded(true);
    setBottomBarExpanded(true);
  }, []);

  return {
    sidebarsExpanded,
    topBarExpanded,
    bottomBarExpanded,
    toggleSidebars,
    toggleTopBar,
    toggleBottomBar,
    setSidebarsExpanded,
    setTopBarExpanded,
    setBottomBarExpanded,
    expandPromptBars,
    isSmallScreen,
  };
}
