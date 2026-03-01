type ModuleNamespace<TModule extends object> = TModule | { default: TModule };

export function unwrapDefaultExport<TModule extends object>(moduleNamespace: ModuleNamespace<TModule>): TModule {
  const candidate = (moduleNamespace as { default?: unknown }).default;
  if (candidate && typeof candidate === 'object') {
    return candidate as TModule;
  }
  return moduleNamespace as TModule;
}
