type TokenLike = {
  realm_access?: {
    roles?: unknown;
  };
} | null | undefined;

export function getRealmRoles(tokenParsed: TokenLike): string[] {
  const roles = tokenParsed?.realm_access?.roles;
  return Array.isArray(roles)
    ? roles.filter((role): role is string => typeof role === "string")
    : [];
}

export function hasRealmRole(tokenParsed: TokenLike, role: string): boolean {
  return getRealmRoles(tokenParsed).includes(role);
}
