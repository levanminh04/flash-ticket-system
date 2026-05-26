type TokenLike = {
  realm_access?: {
    roles?: unknown;
  };
  resource_access?: Record<string, { roles?: unknown } | undefined>;
  roles?: unknown;
} | null | undefined;

export function getRealmRoles(tokenParsed: TokenLike): string[] {
  const roleSources = [
    tokenParsed?.realm_access?.roles,
    tokenParsed?.roles,
    ...Object.values(tokenParsed?.resource_access || {}).map(
      (resource) => resource?.roles,
    ),
  ];

  return Array.from(
    new Set(
      roleSources.flatMap((roles) =>
        Array.isArray(roles)
          ? roles.filter((role): role is string => typeof role === "string")
          : [],
      ),
    ),
  );
}

function normalizeRole(role: string): string {
  return role.replace(/^ROLE_/i, "").toUpperCase();
}

export function hasRealmRole(tokenParsed: TokenLike, role: string): boolean {
  const expectedRole = normalizeRole(role);
  return getRealmRoles(tokenParsed).some(
    (currentRole) => normalizeRole(currentRole) === expectedRole,
  );
}

export function hasAnyRealmRole(tokenParsed: TokenLike, roles: string[]): boolean {
  const expectedRoles = new Set(roles.map(normalizeRole));
  return getRealmRoles(tokenParsed).some((currentRole) =>
    expectedRoles.has(normalizeRole(currentRole)),
  );
}
