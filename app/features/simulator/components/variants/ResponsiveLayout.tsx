/**
 * ResponsiveLayout - Breakpoint-aware layout switcher
 *
 * Automatically switches between MobileLayout and OnionLayout
 * based on screen size. Provides a seamless responsive experience.
 */

'use client';

import React, { memo, useMemo } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { OnionLayout, OnionLayoutProps } from './OnionLayout';
import { MobileLayout, MobileLayoutProps } from './MobileLayout';

export interface ResponsiveLayoutProps extends OnionLayoutProps {
  /** Force a specific layout (useful for testing) */
  forceLayout?: 'mobile' | 'desktop';
}

function ResponsiveLayoutComponent({
  forceLayout,
  ...props
}: ResponsiveLayoutProps) {
  const { isMobile, isTablet, isTouch, isPortrait } = useResponsive();

  // Determine which layout to use
  const useMobileLayout = useMemo(() => {
    // Force override
    if (forceLayout === 'mobile') return true;
    if (forceLayout === 'desktop') return false;

    // Use mobile layout for:
    // - Mobile devices (< 640px)
    // - Tablets in portrait mode with touch
    return isMobile || (isTablet && isPortrait && isTouch);
  }, [forceLayout, isMobile, isTablet, isPortrait, isTouch]);

  if (useMobileLayout) {
    // Extract mobile-compatible props
    const mobileProps: MobileLayoutProps = {
      generatedImages: props.generatedImages,
      isGeneratingImages: props.isGeneratingImages,
      onStartImage: props.onStartImage,
      savedPromptIds: props.savedPromptIds,
      onViewPrompt: props.onViewPrompt,
    };

    return <MobileLayout {...mobileProps} />;
  }

  return <OnionLayout {...props} />;
}

export const ResponsiveLayout = memo(ResponsiveLayoutComponent);

export default ResponsiveLayout;
