// WebAssembly Plugin System for Life Gamification App

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: Permission[];
  commands: PluginCommand[];
  hooks: PluginHook[];
  settings?: PluginSetting[];
}

export interface Permission {
  type: 'storage' | 'notifications' | 'tasks' | 'user_data' | 'network' | 'files';
  description: string;
  required: boolean;
}

export interface PluginCommand {
  id: string;
  name: string;
  description: string;
  category: string;
  shortcut?: string;
  icon?: string;
}

export interface PluginHook {
  event: 'task_created' | 'task_completed' | 'level_up' | 'achievement_unlocked' | 'daily_stats';
  callback: string; // Function name in WASM module
}

export interface PluginSetting {
  key: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  default: any;
  options?: string[]; // For select type
  description?: string;
}

export interface PluginInstance {
  id: string;
  manifest: PluginManifest;
  module: WebAssembly.Module | null;
  instance: WebAssembly.Instance | null;
  enabled: boolean;
  settings: Record<string, any>;
  lastError?: string;
}

class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private permissionCallbacks: Map<string, () => Promise<boolean>> = new Map();

  // Initialize the plugin system
  async initialize(): Promise<void> {
    // Set up permission handlers
    this.setupPermissionHandlers();
    
    // Load any pre-installed plugins
    await this.loadInstalledPlugins();
    
    console.log('Plugin system initialized');
  }

  private setupPermissionHandlers(): void {
    // Storage permission handler
    this.permissionCallbacks.set('storage', async () => {
      return confirm('This plugin requests access to local storage. Allow?');
    });

    // Notifications permission handler
    this.permissionCallbacks.set('notifications', async () => {
      return confirm('This plugin wants to send notifications. Allow?');
    });

    // Tasks permission handler
    this.permissionCallbacks.set('tasks', async () => {
      return confirm('This plugin requests access to your tasks. Allow?');
    });

    // User data permission handler
    this.permissionCallbacks.set('user_data', async () => {
      return confirm('This plugin requests access to your user data. Allow?');
    });

    // Network permission handler
    this.permissionCallbacks.set('network', async () => {
      return confirm('This plugin wants to make network requests. Allow?');
    });
  }

  // Load a plugin from a WASM file
  async loadPlugin(wasmBytes: Uint8Array, manifest: PluginManifest): Promise<boolean> {
    try {
      // Validate manifest
      if (!this.validateManifest(manifest)) {
        throw new Error('Invalid plugin manifest');
      }

      // Check if plugin already exists
      if (this.plugins.has(manifest.id)) {
        throw new Error(`Plugin ${manifest.id} is already loaded`);
      }

      // Request permissions
      const permissionsGranted = await this.requestPermissions(manifest.permissions);
      if (!permissionsGranted) {
        throw new Error('Required permissions not granted');
      }

      // Compile WASM module
      const module = await WebAssembly.compile(wasmBytes);

      // Create import object with limited API
      const imports = this.createImportObject(manifest);

      // Instantiate the module
      const instance = await WebAssembly.instantiate(module, imports);

      // Create plugin instance
      const plugin: PluginInstance = {
        id: manifest.id,
        manifest,
        module,
        instance,
        enabled: true,
        settings: this.getDefaultSettings(manifest.settings || [])
      };

      // Store the plugin
      this.plugins.set(manifest.id, plugin);

      // Initialize the plugin
      await this.initializePlugin(plugin);

      console.log(`Plugin ${manifest.name} loaded successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to load plugin ${manifest.name}:`, error);
      return false;
    }
  }

  private validateManifest(manifest: PluginManifest): boolean {
    return !!(
      manifest.id &&
      manifest.name &&
      manifest.version &&
      manifest.author &&
      Array.isArray(manifest.permissions) &&
      Array.isArray(manifest.commands)
    );
  }

  private async requestPermissions(permissions: Permission[]): Promise<boolean> {
    for (const permission of permissions) {
      if (permission.required) {
        const handler = this.permissionCallbacks.get(permission.type);
        if (handler) {
          const granted = await handler();
          if (!granted) {
            return false;
          }
        }
      }
    }
    return true;
  }

  private createImportObject(manifest: PluginManifest): WebAssembly.Imports {
    const imports: WebAssembly.Imports = {
      env: {
        // Memory management
        memory: new WebAssembly.Memory({ initial: 1, maximum: 10 }),
        
        // Basic functions
        console_log: (ptr: number, len: number) => {
          const buffer = new Uint8Array((this.plugins.get(manifest.id)?.instance?.exports.memory as WebAssembly.Memory)?.buffer || new ArrayBuffer(0));
          const text = new TextDecoder().decode(buffer.slice(ptr, ptr + len));
          console.log(`[Plugin ${manifest.name}]:`, text);
        },

        // Task API (if permission granted)
        ...(manifest.permissions.some(p => p.type === 'tasks') && {
          create_task: (titlePtr: number, titleLen: number, descPtr: number, descLen: number) => {
            // Implementation would create a task through the game store
            console.log('Plugin creating task...');
            return 1; // Success
          },
          
          complete_task: (taskId: number) => {
            // Implementation would complete a task
            console.log('Plugin completing task:', taskId);
            return 1; // Success
          }
        }),

        // Storage API (if permission granted)
        ...(manifest.permissions.some(p => p.type === 'storage') && {
          storage_set: (keyPtr: number, keyLen: number, valuePtr: number, valueLen: number) => {
            // Safe storage implementation
            const memory = (this.plugins.get(manifest.id)?.instance?.exports.memory as WebAssembly.Memory)?.buffer;
            if (!memory) return 0;
            
            const buffer = new Uint8Array(memory);
            const key = new TextDecoder().decode(buffer.slice(keyPtr, keyPtr + keyLen));
            const value = new TextDecoder().decode(buffer.slice(valuePtr, valuePtr + valueLen));
            
            // Store with plugin prefix to avoid conflicts
            localStorage.setItem(`plugin_${manifest.id}_${key}`, value);
            return 1;
          },

          storage_get: (keyPtr: number, keyLen: number, outPtr: number, maxLen: number) => {
            const memory = (this.plugins.get(manifest.id)?.instance?.exports.memory as WebAssembly.Memory)?.buffer;
            if (!memory) return 0;
            
            const buffer = new Uint8Array(memory);
            const key = new TextDecoder().decode(buffer.slice(keyPtr, keyPtr + keyLen));
            const value = localStorage.getItem(`plugin_${manifest.id}_${key}`) || '';
            
            const encoded = new TextEncoder().encode(value);
            const length = Math.min(encoded.length, maxLen);
            buffer.set(encoded.slice(0, length), outPtr);
            
            return length;
          }
        }),

        // Notification API (if permission granted)
        ...(manifest.permissions.some(p => p.type === 'notifications') && {
          send_notification: (titlePtr: number, titleLen: number, msgPtr: number, msgLen: number) => {
            const memory = (this.plugins.get(manifest.id)?.instance?.exports.memory as WebAssembly.Memory)?.buffer;
            if (!memory) return 0;
            
            const buffer = new Uint8Array(memory);
            const title = new TextDecoder().decode(buffer.slice(titlePtr, titlePtr + titleLen));
            const message = new TextDecoder().decode(buffer.slice(msgPtr, msgPtr + msgLen));
            
            // Send notification through the app's notification system
            console.log(`Plugin notification: ${title} - ${message}`);
            return 1;
          }
        })
      }
    };

    return imports;
  }

  private getDefaultSettings(settings: PluginSetting[]): Record<string, any> {
    const defaults: Record<string, any> = {};
    settings.forEach(setting => {
      defaults[setting.key] = setting.default;
    });
    return defaults;
  }

  private async initializePlugin(plugin: PluginInstance): Promise<void> {
    if (!plugin.instance) return;

    // Call the plugin's initialization function if it exists
    const exports = plugin.instance.exports as any;
    if (typeof exports.initialize === 'function') {
      try {
        exports.initialize();
      } catch (error) {
        console.error(`Plugin ${plugin.id} initialization failed:`, error);
        plugin.lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }
  }

  private async loadInstalledPlugins(): Promise<void> {
    // In a real implementation, this would load plugins from storage
    console.log('Loading installed plugins...');
    
    // Mock plugin for demonstration
    const mockManifest: PluginManifest = {
      id: 'productivity_timer',
      name: 'Productivity Timer',
      version: '1.0.0',
      description: 'Advanced Pomodoro timer with customizable intervals',
      author: 'Community',
      permissions: [
        { type: 'notifications', description: 'Send timer notifications', required: true },
        { type: 'storage', description: 'Save timer settings', required: false }
      ],
      commands: [
        { id: 'start_timer', name: 'Start Timer', description: 'Start a productivity timer', category: 'productivity' },
        { id: 'stop_timer', name: 'Stop Timer', description: 'Stop the current timer', category: 'productivity' }
      ],
      hooks: [
        { event: 'task_completed', callback: 'on_task_completed' }
      ],
      settings: [
        { key: 'work_duration', name: 'Work Duration', type: 'number', default: 25, description: 'Work session duration in minutes' },
        { key: 'break_duration', name: 'Break Duration', type: 'number', default: 5, description: 'Break duration in minutes' },
        { key: 'auto_start', name: 'Auto Start', type: 'boolean', default: false, description: 'Automatically start the next session' }
      ]
    };

    // Create a minimal mock plugin instance (without actual WASM)
    const mockPlugin: PluginInstance = {
      id: mockManifest.id,
      manifest: mockManifest,
      module: null,
      instance: null,
      enabled: true,
      settings: this.getDefaultSettings(mockManifest.settings || [])
    };

    this.plugins.set(mockManifest.id, mockPlugin);
  }

  // Execute a plugin command
  async executeCommand(pluginId: string, commandId: string, args?: any): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.enabled) {
      throw new Error(`Plugin ${pluginId} not found or disabled`);
    }

    const command = plugin.manifest.commands.find(cmd => cmd.id === commandId);
    if (!command) {
      throw new Error(`Command ${commandId} not found in plugin ${pluginId}`);
    }

    try {
      if (plugin.instance) {
        const exports = plugin.instance.exports as any;
        const functionName = `execute_${commandId}`;
        
        if (typeof exports[functionName] === 'function') {
          return exports[functionName](args);
        }
      }
      
      // Mock execution for demo
      console.log(`Executing command ${commandId} from plugin ${pluginId}`);
      return { success: true, message: `Command ${commandId} executed` };
    } catch (error) {
      console.error(`Failed to execute command ${commandId}:`, error);
      throw error;
    }
  }

  // Get all loaded plugins
  getPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  // Get commands from all enabled plugins
  getPluginCommands(): { plugin: PluginInstance; command: PluginCommand }[] {
    const commands: { plugin: PluginInstance; command: PluginCommand }[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        for (const command of plugin.manifest.commands) {
          commands.push({ plugin, command });
        }
      }
    }
    
    return commands;
  }

  // Enable/disable a plugin
  setPluginEnabled(pluginId: string, enabled: boolean): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = enabled;
      console.log(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  // Update plugin settings
  updatePluginSettings(pluginId: string, settings: Record<string, any>): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.settings = { ...plugin.settings, ...settings };
      
      // Notify plugin of settings change if it has a callback
      if (plugin.instance) {
        const exports = plugin.instance.exports as any;
        if (typeof exports.on_settings_changed === 'function') {
          exports.on_settings_changed();
        }
      }
    }
  }

  // Unload a plugin
  unloadPlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      // Cleanup plugin resources
      if (plugin.instance) {
        const exports = plugin.instance.exports as any;
        if (typeof exports.cleanup === 'function') {
          exports.cleanup();
        }
      }
      
      this.plugins.delete(pluginId);
      console.log(`Plugin ${pluginId} unloaded`);
    }
  }

  // Trigger plugin hooks
  async triggerHook(event: PluginHook['event'], data?: any): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.instance) continue;
      
      const hooks = plugin.manifest.hooks.filter(hook => hook.event === event);
      for (const hook of hooks) {
        try {
          const exports = plugin.instance.exports as any;
          if (typeof exports[hook.callback] === 'function') {
            exports[hook.callback](data);
          }
        } catch (error) {
          console.error(`Plugin ${plugin.id} hook ${hook.callback} failed:`, error);
        }
      }
    }
  }
}

// Export singleton instance
export const pluginManager = new PluginManager();

// Convenience functions
export const loadPlugin = (wasmBytes: Uint8Array, manifest: PluginManifest) =>
  pluginManager.loadPlugin(wasmBytes, manifest);

export const executePluginCommand = (pluginId: string, commandId: string, args?: any) =>
  pluginManager.executeCommand(pluginId, commandId, args);

export const getPluginCommands = () => pluginManager.getPluginCommands();

export const initializePluginSystem = () => pluginManager.initialize();