/**
 * Migration Script: Sync IndexedDB Panel Images to Supabase
 *
 * Run this in the browser console while on the simulator page.
 * This script will:
 * - Create missing projects in the database
 * - Sync all panel images with their video URLs
 *
 * Usage:
 * 1. Open http://localhost:3000 in browser
 * 2. Open DevTools (F12) → Console tab
 * 3. Copy and paste this entire script
 * 4. Press Enter to run
 */

(async function migratePanelImages() {
  console.log('🚀 Starting panel images migration...\n');

  // Open IndexedDB
  const DB_NAME = 'simulator_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'panel_images';

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  }

  function getAllKeys(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onerror = () => reject(new Error('Failed to get keys'));
      request.onsuccess = () => resolve(request.result);
    });
  }

  function getData(db, key) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(new Error('Failed to get data'));
      request.onsuccess = () => resolve(request.result?.data || null);
    });
  }

  // Try to get project name from localStorage
  function getProjectName(projectId) {
    try {
      // Try various localStorage keys that might have project names
      const projectsKey = 'simulator_projects';
      const projectsData = localStorage.getItem(projectsKey);
      if (projectsData) {
        const projects = JSON.parse(projectsData);
        const project = projects.find(p => p.id === projectId);
        if (project?.name) return project.name;
      }

      // Try individual project key
      const projectKey = `simulator_project_${projectId}`;
      const projectData = localStorage.getItem(projectKey);
      if (projectData) {
        const project = JSON.parse(projectData);
        if (project?.name) return project.name;
      }
    } catch (e) {
      // Ignore parsing errors
    }
    return null;
  }

  try {
    const db = await openDB();
    console.log('✅ IndexedDB opened successfully');

    const keys = await getAllKeys(db);
    console.log(`📦 Found ${keys.length} storage keys:`, keys);

    // Filter for panel_images keys
    const panelKeys = keys.filter(k => k.startsWith('panel_images_'));
    console.log(`🖼️  Found ${panelKeys.length} panel image entries\n`);

    if (panelKeys.length === 0) {
      console.log('⚠️  No panel images found in IndexedDB. Nothing to migrate.');
      return;
    }

    let totalSynced = 0;
    let totalErrors = 0;
    let projectsCreated = 0;

    for (const key of panelKeys) {
      // Extract project ID from key (format: panel_images_<projectId>)
      const projectId = key.replace('panel_images_', '');
      const projectName = getProjectName(projectId);
      console.log(`\n📁 Processing project: ${projectId}${projectName ? ` (${projectName})` : ''}`);

      const data = await getData(db, key);
      if (!data) {
        console.log(`  ⚠️  No data found for key: ${key}`);
        continue;
      }

      const { leftSlots = [], rightSlots = [] } = data;

      // Collect all images from slots
      const images = [];

      leftSlots.forEach((slot, index) => {
        if (slot.image) {
          images.push({
            id: slot.image.id,
            side: 'left',
            slotIndex: index,
            imageUrl: slot.image.url,
            videoUrl: slot.image.videoUrl || null,
            prompt: slot.image.prompt || null,
            createdAt: slot.image.createdAt || new Date().toISOString(),
          });
        }
      });

      rightSlots.forEach((slot, index) => {
        if (slot.image) {
          images.push({
            id: slot.image.id,
            side: 'right',
            slotIndex: index,
            imageUrl: slot.image.url,
            videoUrl: slot.image.videoUrl || null,
            prompt: slot.image.prompt || null,
            createdAt: slot.image.createdAt || new Date().toISOString(),
          });
        }
      });

      console.log(`  📊 Found ${images.length} images (${leftSlots.filter(s => s.image).length} left, ${rightSlots.filter(s => s.image).length} right)`);

      if (images.length === 0) {
        console.log(`  ⏭️  No images to sync for this project`);
        continue;
      }

      // Log video URLs found
      const imagesWithVideos = images.filter(img => img.videoUrl);
      if (imagesWithVideos.length > 0) {
        console.log(`  🎬 Found ${imagesWithVideos.length} images with video URLs:`);
        imagesWithVideos.forEach(img => {
          console.log(`     - ${img.side}[${img.slotIndex}]: ${img.videoUrl.substring(0, 60)}...`);
        });
      }

      // Call sync API (will create project if needed)
      try {
        console.log(`  🔄 Syncing to database...`);
        const response = await fetch(`/api/projects/${projectId}/images/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images,
            projectName: projectName || `Migrated Project ${new Date().toLocaleDateString()}`,
          }),
        });

        const result = await response.json();

        if (result.success) {
          console.log(`  ✅ Synced ${result.synced} images`);
          totalSynced += result.synced;

          if (result.errors && result.errors.length > 0) {
            console.log(`  ⚠️  ${result.errors.length} errors:`);
            result.errors.forEach(err => console.log(`     - ${err}`));
            totalErrors += result.errors.length;
          }
        } else {
          console.log(`  ❌ Sync failed: ${result.error}`);
          totalErrors++;
        }
      } catch (err) {
        console.log(`  ❌ API error: ${err.message}`);
        totalErrors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Total images synced: ${totalSynced}`);
    console.log(`   ❌ Total errors: ${totalErrors}`);
    console.log('='.repeat(50));

    if (totalSynced > 0) {
      console.log('\n🎉 Migration complete! Refresh the page to see updated data.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
})();
