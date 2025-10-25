// Service worker and cache cleanup script
(function() {
  'use strict';
  
  console.log('🧹 Cache cleanup script loaded');

  // Unregister all service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (let registration of registrations) {
        registration.unregister().then(function(success) {
          if (success) {
            console.log('✅ Service worker unregistered:', registration.scope);
          }
        });
      }
    }).catch(function(err) {
      console.error('❌ Error unregistering service workers:', err);
    });
  }

  // Clear all caches
  if ('caches' in window) {
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('🗑️ Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      console.log('✅ All caches cleared');
    }).catch(function(err) {
      console.error('❌ Error clearing caches:', err);
    });
  }

  console.log('🧹 Cache cleanup complete');
})();
