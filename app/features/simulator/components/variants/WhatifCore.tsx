/**
 * WhatifCore - What If comparison mode core layout
 *
 * Before/After image comparison workflow:
 * - Large centered comparison panel
 * - Upload areas for before and after images
 * - Minimal chrome for maximum comparison visibility
 */

'use client';

import React, { memo } from 'react';
import { WhatIfPanel } from '../../subfeature_brain/components/WhatIfPanel';
import { useProjectContext } from '../../contexts';

export interface WhatifCoreProps {
  // Currently no additional props needed
  // Project context provides projectId
}

function WhatifCoreComponent(_props: WhatifCoreProps) {
  const project = useProjectContext();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden z-10 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="shrink-0 px-lg py-md border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-slate-200">What If Comparison</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload before and after images to showcase your transformation
            </p>
          </div>
        </div>
      </div>

      {/* Main Comparison Area */}
      <div className="flex-1 overflow-hidden p-lg">
        <div className="h-full bg-slate-900/30 radius-lg border border-slate-800/50 overflow-hidden">
          <WhatIfPanel projectId={project.currentProject?.id || null} />
        </div>
      </div>
    </div>
  );
}

export const WhatifCore = memo(WhatifCoreComponent);
export default WhatifCore;
