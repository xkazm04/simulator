/**
 * Panel Images API
 *
 * POST /api/projects/[id]/images - Save image to panel slot
 * PATCH /api/projects/[id]/images - Update image video URL
 * DELETE /api/projects/[id]/images - Remove image from slot
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, DbPanelImage } from '@/app/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SaveImageBody {
  side: 'left' | 'right';
  slotIndex: number;
  imageUrl: string;
  videoUrl?: string;
  prompt?: string;
}

interface UpdateImageBody {
  imageId: string;
  videoUrl?: string;
  imageUrl?: string;
}

interface DeleteImageBody {
  imageId: string;
}

/**
 * POST - Save image to panel slot
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body: SaveImageBody = await request.json();
    const { side, slotIndex, imageUrl, videoUrl, prompt } = body;

    // Validate input
    if (!side || !['left', 'right'].includes(side)) {
      return NextResponse.json(
        { success: false, error: 'Invalid side (must be "left" or "right")' },
        { status: 400 }
      );
    }
    if (slotIndex === undefined || slotIndex < 0 || slotIndex >= 5) {
      return NextResponse.json(
        { success: false, error: 'Invalid slot index (must be 0-4)' },
        { status: 400 }
      );
    }
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Image URL is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Check project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Use INSERT OR REPLACE to handle existing slot
    const imageId = uuidv4();

    // First delete any existing image in this slot
    db.prepare(`
      DELETE FROM panel_images
      WHERE project_id = ? AND side = ? AND slot_index = ?
    `).run(projectId, side, slotIndex);

    // Insert new image
    db.prepare(`
      INSERT INTO panel_images (id, project_id, side, slot_index, image_url, video_url, prompt, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(imageId, projectId, side, slotIndex, imageUrl, videoUrl || null, prompt || null, now);

    // Update project timestamp
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
      .run(now, projectId);

    const panelImage: DbPanelImage = {
      id: imageId,
      project_id: projectId,
      side,
      slot_index: slotIndex,
      image_url: imageUrl,
      video_url: videoUrl || null,
      prompt: prompt || null,
      created_at: now,
    };

    return NextResponse.json({
      success: true,
      image: panelImage,
    });
  } catch (error) {
    console.error('Save panel image error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save image' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update image video URL
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body: UpdateImageBody = await request.json();
    const { imageId, videoUrl, imageUrl } = body;

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Image ID is required' },
        { status: 400 }
      );
    }

    if (!videoUrl && !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Either videoUrl or imageUrl is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (videoUrl !== undefined) {
      updates.push('video_url = ?');
      values.push(videoUrl || null);
    }
    if (imageUrl !== undefined) {
      updates.push('image_url = ?');
      values.push(imageUrl);
    }

    values.push(imageId, projectId);

    const result = db.prepare(`
      UPDATE panel_images
      SET ${updates.join(', ')}
      WHERE id = ? AND project_id = ?
    `).run(...values);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    // Update project timestamp
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
      .run(now, projectId);

    // Fetch updated image
    const updatedImage = db.prepare(`
      SELECT * FROM panel_images WHERE id = ?
    `).get(imageId) as DbPanelImage;

    return NextResponse.json({
      success: true,
      image: updatedImage,
    });
  } catch (error) {
    console.error('Update panel image error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update image' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove image from slot
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body: DeleteImageBody = await request.json();
    const { imageId } = body;

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Image ID is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    const result = db.prepare(`
      DELETE FROM panel_images
      WHERE id = ? AND project_id = ?
    `).run(imageId, projectId);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Image not found' },
        { status: 404 }
      );
    }

    // Update project timestamp
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?')
      .run(now, projectId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete panel image error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
