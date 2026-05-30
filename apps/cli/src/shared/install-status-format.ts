const INSTALL_STATUS_ICON = {
  installed: '✓',
  notInstalled: '○',
} as const;

export const formatInstallStatus = (installed: boolean): string =>
  installed ? `${INSTALL_STATUS_ICON.installed} installed` : `${INSTALL_STATUS_ICON.notInstalled} not installed`;

export const formatInstallStatusForTools = (tools: readonly string[] | null): string =>
  tools ? `${INSTALL_STATUS_ICON.installed} installed for ${tools.join(', ')}` : formatInstallStatus(false);
