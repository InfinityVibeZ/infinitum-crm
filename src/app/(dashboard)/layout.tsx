import { DashboardClient } from "./DashboardClient";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_PERMISSIONS } from "@/lib/permissions";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus-access-token")?.value;
  let userRole = "USER";

  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload && payload.role) {
        userRole = payload.role;
      }
    } catch (e) {}
  }

  // Fetch ROLE_PERMISSIONS from DB
  const config = await prisma.systemConfig.findFirst({
    where: { key: "ROLE_PERMISSIONS" },
  });

  let activePermissions = DEFAULT_PAGE_PERMISSIONS as Record<string, any>;

  if (config && config.value) {
    try {
      const dbPerms = typeof config.value === 'string' ? JSON.parse(config.value) : config.value;
      activePermissions = { ...DEFAULT_PAGE_PERMISSIONS, ...dbPerms };
    } catch (e) {}
  }

  // Flatten the matrix to only the boolean map for the user's role
  const flattenedPermissions: Record<string, boolean> = {};
  for (const [path, access] of Object.entries(activePermissions)) {
    if (typeof access === "boolean") {
      flattenedPermissions[path] = access;
    } else if (access && typeof access === "object") {
      flattenedPermissions[path] = access[userRole] === true;
    } else {
      flattenedPermissions[path] = false;
    }
  }

  return (
    <DashboardClient permissions={flattenedPermissions}>
      {children}
    </DashboardClient>
  );
}
