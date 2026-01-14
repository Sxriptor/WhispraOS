// Simple test to verify token clearing
// Run this in browser console

console.log('🧪 Simple token clear test...');

if (window.electronAPI) {
  console.log('📝 To test:');
  console.log('1. Run: window.electronAPI.signOut()');
  console.log('2. Check console for: "✅ ALL authentication data cleared"');
  console.log('3. Try signing in again - it should work normally');
  
  // Test sign out
  window.electronAPI.signOut().then(result => {
    console.log('Sign out result:', result);
    if (result.success) {
      console.log('✅ Sign out successful - check console logs for clearing messages');
    } else {
      console.log('❌ Sign out failed:', result.error);
    }
  }).catch(error => {
    console.error('❌ Error during sign out:', error);
  });
} else {
  console.log('❌ Electron API not available');
}
