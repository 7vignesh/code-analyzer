export function hasPermission(role: string, action: string): boolean {
  return role === 'admin' || action === 'read';
}
