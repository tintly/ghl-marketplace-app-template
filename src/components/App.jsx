@@ .. @@
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <div className="text-center">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
-          <p className="text-gray-600">Loading your data extractor...</p>
+          <p className="text-gray-600">Loading...</p>
           <p className="text-sm text-gray-500 mt-2">
-            {user?.standaloneMode ? 'Running in standalone mode...' : 'Connecting to GoHighLevel...'}
+            {user?.standaloneMode ? 'Running in standalone mode...' : 'Connecting to your account...'}
           </p>
         </div>
       </div>