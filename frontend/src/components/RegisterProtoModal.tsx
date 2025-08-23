import React, { useState, useRef } from 'react';
import { X, FileText, Folder, Upload, FolderOpen } from 'lucide-react';
import { MessageType } from '../lib/types';
import { protoApi } from '../lib/api';
import { useQueryClient } from 'react-query';

interface RegisterProtoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (data: { path: string; includePaths?: string[] }) => void;
  isLoading: boolean;
  messageTypes: MessageType[];
}

export const RegisterProtoModal: React.FC<RegisterProtoModalProps> = ({
  isOpen,
  onClose,
  onRegister,
  isLoading,
  messageTypes
}) => {
  const [path, setPath] = useState('');
  const [includePaths, setIncludePaths] = useState('');
  const [isDirectory, setIsDirectory] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadMethod, setUploadMethod] = useState<'path' | 'upload'>('path');
  const [protocError, setProtocError] = useState<{
    type: 'missing_dependencies' | 'generic' | 'simple_guidance';
    message: string;
    missingFiles?: string[];
    fullError: string;
  } | null>(null);

  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  // Extract missing proto file dependencies from protoc error message
  const extractMissingDependencies = (errorMsg: string): string[] => {
    const missingFiles = new Set<string>();
    
    // Handle the full error message which might include "protoc failed: exit status 1, output: ..."
    let outputSection = errorMsg;
    if (errorMsg.includes('output: ')) {
      outputSection = errorMsg.split('output: ')[1] || errorMsg;
    }
    
    const lines = outputSection.split('\n');
    
    for (const line of lines) {
      // Look for "File not found" patterns (more flexible)
      const fileNotFoundMatch = line.match(/([^:\s]+\.proto): File not found\.?/);
      if (fileNotFoundMatch) {
        missingFiles.add(fileNotFoundMatch[1]);
      }
      
      // Look for Import patterns
      const importMatch = line.match(/Import "([^"]+\.proto)" was not found/);
      if (importMatch) {
        missingFiles.add(importMatch[1]);
      }
      
      // Look for import patterns in error messages like "payment3_orchestratorpb.proto:8:1: Import "common/conf.proto" was not found"
      const importErrorMatch = line.match(/Import "([^"]+\.proto)" was not found or had errors/);
      if (importErrorMatch) {
        missingFiles.add(importErrorMatch[1]);
      }
    }
    
    return Array.from(missingFiles);
  };

  // Generate suggestions for where to find missing files
  const generateFileSuggestions = (missingFile: string): string[] => {
    const suggestions = [];
    const fileName = missingFile.split('/').pop() || missingFile;
    const dirPath = missingFile.includes('/') ? missingFile.substring(0, missingFile.lastIndexOf('/')) : '';
    
    // Based on common protobuf project structures
    if (dirPath) {
      suggestions.push(`Look for "${fileName}" in a "${dirPath}/" subdirectory relative to your main .proto file`);
    }
    
    // Common patterns
    if (missingFile.includes('common/')) {
      suggestions.push(`Check for a "common/" directory in your project root - this usually contains shared definitions`);
    }
    
    if (missingFile.includes('_pb') || missingFile.includes('pb/')) {
      suggestions.push(`Look in protobuf-specific directories (often named "pb", "proto", or ending in "_pb")`);
    }
    
    if (missingFile.includes('/')) {
      const parts = missingFile.split('/');
      if (parts.length > 1) {
        suggestions.push(`This file is in a "${parts[0]}/" subdirectory - make sure to include the entire folder structure`);
      }
    }
    
    // Generic suggestions
    suggestions.push(`Search your codebase for "${fileName}" using your IDE's file search`);
    
    if (missingFile.includes('google/') || missingFile.includes('googleapis/')) {
      suggestions.push(`This looks like a Google API proto - you may need to install googleapis or protobuf dependencies`);
    }
    
    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProtocError(null); // Clear any previous errors
    
    try {
      if (uploadMethod === 'upload') {
        if (selectedFiles.length === 0) return;

        // Debug what we're sending
        console.log('Submitting files:', selectedFiles.map(f => ({ 
          name: f.name, 
          webkitRelativePath: (f as any).webkitRelativePath,
          _relativePath: (f as any)._relativePath,
          relativePath: (f as any).webkitRelativePath || (f as any)._relativePath || f.name,
          type: f.type, 
          size: f.size 
        })));
        
        // Use the file upload API
        await protoApi.registerFromFiles(selectedFiles);
        // Ensure dropdown updates immediately
        queryClient.invalidateQueries('messageTypes');
        queryClient.refetchQueries('messageTypes');
      } else {
        if (!path.trim()) return;

        const includePathsArray = includePaths.trim() 
          ? includePaths.split(',').map(p => p.trim()).filter(Boolean)
          : undefined;

        // Use the path-based API
        onRegister({
          path: path.trim(),
          includePaths: includePathsArray
        });
        // Invalidate list since the mutation lives outside this component for path mode
        queryClient.invalidateQueries('messageTypes');
        queryClient.refetchQueries('messageTypes');
      }

      // Reset form
      setPath('');
      setIncludePaths('');
      setIsDirectory(false);
      setSelectedFiles([]);
      setUploadMethod('path');
      
      // Close modal on success
      onClose();
    } catch (error: any) {
      console.error('Failed to register protobuf files:', error);
      
      // Handle specific protoc dependency errors
      if (error.message && error.message.includes('protoc failed')) {
        const errorMsg = error.message;
        if (errorMsg.includes('File not found') || errorMsg.includes('Import') || errorMsg.includes('was not found')) {
          // For upload mode, show simple guidance
          if (uploadMethod === 'upload') {
            setProtocError({
              type: 'simple_guidance',
              message: 'Couldn\'t resolve imports. Click Add Directory to upload the whole folder and try again.',
              fullError: errorMsg
            });
            return;
          }
          
          // For path mode, show detailed dependency info
          const missingFiles = extractMissingDependencies(errorMsg);
          console.log('Extracted missing files:', missingFiles);
          console.log('Full error for parsing:', errorMsg);
          
          setProtocError({
            type: 'missing_dependencies',
            message: 'Missing protobuf dependencies',
            missingFiles,
            fullError: errorMsg
          });
          return;
        }
      }
      
      // Generic error
      setProtocError({
        type: 'generic',
        message: error.message || 'Failed to register protobuf files',
        fullError: error.message
      });
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setPath('');
      setIncludePaths('');
      setIsDirectory(false);
      setSelectedFiles([]);
      setUploadMethod('path');
      setProtocError(null);
      onClose();
    }
  };


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileSelect called - using traditional input');
    const rawFiles = Array.from(e.target.files || []).filter(f => f.name.endsWith('.proto'));
    console.log('Proto files selected:', rawFiles.map(f => f.name));
    
    // Just add files directly - backend will handle import resolution
    addFiles(rawFiles);
  };

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []).filter(f => f.name.endsWith('.proto'));
    console.log('Directory selected, proto files:', rawFiles.map(f => f.name));
    
    // Just add files directly - backend will handle import resolution
    addFiles(rawFiles);
    setIsDirectory(true);
  };

  // Add files to the existing collection (avoiding duplicates by relative path)
  const addFiles = (newFiles: File[]) => {
    const existingRelativePaths = new Set(selectedFiles.map(f => 
      (f as any)._relativePath || (f as any).webkitRelativePath || f.name
    ));
    const uniqueFiles = newFiles.filter(f => {
      const relativePath = (f as any)._relativePath || (f as any).webkitRelativePath || f.name;
      return !existingRelativePaths.has(relativePath);
    });
    
    if (uniqueFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...uniqueFiles]);
      console.log(`Added ${uniqueFiles.length} new files, ${newFiles.length - uniqueFiles.length} duplicates skipped`);
    } else {
      console.log('No new files added - all files were duplicates');
    }
  };

  // Remove a specific file
  const removeFile = (fileToRemove: File) => {
    setSelectedFiles(prev => prev.filter(f => f !== fileToRemove));
  };

  // Clear all files
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setIsDirectory(false);
    setProtocError(null);
  };



  // Modern file picker (Chrome) with fallback
  const openFilePicker = async () => {
    console.log('openFilePicker called');
    // Try modern File System Access API first (Chrome)
    if ('showOpenFilePicker' in window) {
      console.log('Using modern File System Access API');
      try {
        const fileHandles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [{
            description: 'Protobuf files',
            accept: { 'text/plain': ['.proto'] }
          }]
        });
        
        const files: File[] = [];
        for (const handle of fileHandles) {
          const file = await handle.getFile();
          files.push(file);
          console.log(`Selected file: ${file.name}`);
        }
        
        console.log('Modern file picker selected:', files);
        console.log('File details:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
        addFiles(files);
        return;
      } catch (error) {
        console.log('Modern file picker cancelled or failed:', error);
        return;
      }
    } else {
      console.log('showOpenFilePicker not available, using traditional file input');
    }
    
    // Fallback to traditional input (Safari)
    if (fileInputRef.current) {
      console.log('Clicking traditional file input');
      fileInputRef.current.click();
    }
  };

  // Modern directory picker (Chrome) with fallback
  const openDirectoryPicker = async () => {
    // Try modern File System Access API first (Chrome)
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];
        
        // Recursively collect .proto files
        async function collectFiles(dirHandle: any, relativePath = '') {
          for await (const [name, handle] of dirHandle.entries()) {
            const currentPath = relativePath ? `${relativePath}/${name}` : name;
            
            if (handle.kind === 'file' && name.endsWith('.proto')) {
              const file = await handle.getFile();
              files.push(file);
              console.log(`Collected file: ${file.name}`);
            } else if (handle.kind === 'directory') {
              console.log(`Entering directory: ${name}`);
              await collectFiles(handle, currentPath);
            }
          }
        }
        
        await collectFiles(dirHandle);
        console.log(`📁 Collected ${files.length} proto files`);
        
        console.log('Modern directory picker selected:', files);
        console.log('Directory file details:', files.map(f => ({ 
          name: f.name, 
          relativePath: (f as any)._relativePath,
          type: f.type, 
          size: f.size 
        })));
        addFiles(files);
        setIsDirectory(true);
        return;
      } catch (error) {
        console.log('Modern directory picker cancelled or failed:', error);
        return;
      }
    }
    
    // Fallback to traditional input (Safari)
    if (directoryInputRef.current) {
      directoryInputRef.current.click();
    }
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Register Protobuf Files
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Upload Method Selection */}
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={uploadMethod === 'path'}
                onChange={() => setUploadMethod('path')}
                className="text-primary-600 focus:ring-primary-500"
              />
              <FileText className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-700">File Path</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                checked={uploadMethod === 'upload'}
                onChange={() => setUploadMethod('upload')}
                className="text-primary-600 focus:ring-primary-500"
              />
              <Upload className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-700">File Upload</span>
            </label>
          </div>

          {uploadMethod === 'path' ? (
            <>
              {/* Path Type Selection */}
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isDirectory}
                    onChange={() => setIsDirectory(false)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <FileText className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Single File</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isDirectory}
                    onChange={() => setIsDirectory(true)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <Folder className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Directory</span>
                </label>
              </div>

              {/* Path Input */}
              <div>
                <label htmlFor="path" className="block text-sm font-medium text-gray-700 mb-2">
                  {isDirectory ? 'Directory Path' : 'File Path'}
                </label>
                <input
                  type="text"
                  id="path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={isDirectory ? "/path/to/proto/directory" : "/path/to/file.proto"}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </>
          ) : (
            <>
              {/* File Upload Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select .proto Files
                  </label>
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm text-green-800">
                      <strong>🎯 Smart Import Resolution</strong>
                      <p className="mt-1 text-xs text-green-700">
                        Select individual files or directories - the system will automatically resolve import paths 
                        like <code>common/common.proto</code> by matching filenames.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {/* Files - Now enabled with smart resolution */}
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <FileText className="h-4 w-4" />
                        {selectedFiles.length > 0 ? 'Add More Files' : 'Select Files'}
                      </button>
                      {/* Hidden input as fallback for Safari (only used if modern API fails) */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".proto"
                        onChange={handleFileSelect}
                        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                      />
                    </div>

                    {/* Directory - Modern API + fallback overlay */}
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        onClick={openDirectoryPicker}
                        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <FolderOpen className="h-4 w-4" />
                        {selectedFiles.length > 0 ? 'Add Directory' : 'Select Directory'}
                      </button>
                      {/* Hidden input as fallback for Safari (only used if modern API fails) */}
                      <input
                        ref={directoryInputRef}
                        type="file"
                        multiple
                        onChange={handleDirectorySelect}
                        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                        {...({ webkitdirectory: '', directory: '' } as any)}
                      />
                    </div>
                  </div>
                </div>

                {/* Dependency Error Display */}
                {protocError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    {protocError.type === 'missing_dependencies' ? (
                      <div>
                        <div className="flex items-center mb-2">
                          <div className="flex-shrink-0">
                            <div className="w-5 h-5 text-red-400">⚠️</div>
                          </div>
                          <div className="ml-2">
                            <h3 className="text-sm font-medium text-red-800">
                              Missing Protobuf Dependencies
                            </h3>
                          </div>
                        </div>
                        <div className="text-sm text-red-700 mb-3">
                          Your .proto file imports other files using specific paths. The imports expect this exact file structure:
                        </div>
                        <div className="space-y-3 mb-4">
                          {protocError.missingFiles?.map((file, index) => (
                            <div key={index} className="border-l-4 border-red-300 pl-4">
                              <div className="font-mono text-sm text-red-800 font-semibold mb-1">
                                📁 {file}
                              </div>
                              <div className="text-xs text-red-600">
                                <strong>Where to find this file:</strong>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  {generateFileSuggestions(file).map((suggestion, sIndex) => (
                                    <li key={sIndex}>{suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Show current uploaded files */}
                        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="text-xs text-blue-800 font-semibold mb-1">Currently uploaded files:</div>
                          <ul className="text-xs text-blue-700 space-y-1">
                            {selectedFiles.map((file, index) => (
                              <li key={index} className="font-mono">📄 {file.name}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="text-xs text-red-600">
                          <strong>Solutions:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            <li><strong>Option 1 (Recommended):</strong> Upload the entire project directory using "Add Directory" to preserve the folder structure</li>
                            <li><strong>Option 2:</strong> Create the expected folder structure and upload the organized files</li>
                            <li><strong>Option 3:</strong> Use "Include Paths" to specify where protoc should look for dependencies</li>
                          </ul>
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <strong>💡 Structure Mismatch:</strong> Your imports use paths like <code>common/common.proto</code> but you may have uploaded <code>common.proto</code> directly. The paths in your import statements must match the actual file locations.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProtocError(null)}
                          className="mt-3 text-xs text-red-600 hover:text-red-800 underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center mb-2">
                          <div className="flex-shrink-0">
                            <div className="w-5 h-5 text-red-400">❌</div>
                          </div>
                          <div className="ml-2">
                            <h3 className="text-sm font-medium text-red-800">Registration Failed</h3>
                          </div>
                        </div>
                        <div className="text-sm text-red-700 mb-2">{protocError.message}</div>
                        <details className="text-xs text-red-600">
                          <summary className="cursor-pointer hover:text-red-800">Show technical details</summary>
                          <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                            {protocError.fullError}
                          </pre>
                        </details>
                        <button
                          type="button"
                          onClick={() => setProtocError(null)}
                          className="mt-3 text-xs text-red-600 hover:text-red-800 underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Files Display */}
                {selectedFiles.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Selected Files ({selectedFiles.length})
                      </label>
                      <button
                        type="button"
                        onClick={clearAllFiles}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-gray-50">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-700 font-mono truncate" title={(file as any)._relativePath || (file as any).webkitRelativePath || file.name}>
                              {(file as any)._relativePath || (file as any).webkitRelativePath || file.name}
                            </span>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(file)}
                            className="ml-2 flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1"
                            title={`Remove ${file.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      💡 Click "Select Files" or "Select Directory" again to add more files
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Include Paths - Only show in path mode */}
          {uploadMethod === 'path' && (
            <div>
              <label htmlFor="includePaths" className="block text-sm font-medium text-gray-700 mb-2">
                Include Paths (optional)
              </label>
              <input
                type="text"
                id="includePaths"
                value={includePaths}
                onChange={(e) => setIncludePaths(e.target.value)}
                placeholder="path1,path2,path3"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated list of additional include paths for protoc
              </p>
            </div>
          )}

          {/* Current Message Types */}
          {messageTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Message Types ({messageTypes.length})
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2 bg-gray-50">
                {messageTypes.map((msg, index) => (
                  <div key={index} className="text-xs text-gray-600 font-mono py-1">
                    {msg.fqName}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (uploadMethod === 'path' ? !path.trim() : selectedFiles.length === 0)}
              className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
