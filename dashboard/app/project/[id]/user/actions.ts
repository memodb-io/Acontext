"use server";

import {
  AcontextClient,
  type User,
  type GetUsersResp,
  type GetUserResourcesResp,
} from "@/lib/acontext/server";

export async function getUsers(
  projectId: string,
  limit: number = 0,
  cursor?: string,
  timeDesc: boolean = false
): Promise<GetUsersResp> {
  try {
    const client = new AcontextClient();
    return await client.getUsers(projectId, limit, cursor, timeDesc);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    throw error;
  }
}

export async function getAllUsers(projectId: string): Promise<User[]> {
  try {
    const client = new AcontextClient();
    const allUsers: User[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const res = await client.getUsers(projectId, 200, cursor, false);
      allUsers.push(...(res.items || []));
      cursor = res.next_cursor;
      hasMore = res.has_more || false;
    }

    return allUsers;
  } catch (error) {
    console.error("Failed to fetch all users:", error);
    return [];
  }
}

export async function deleteUser(
  projectId: string,
  identifier: string
): Promise<void> {
  try {
    const client = new AcontextClient();
    return await client.deleteUser(projectId, identifier);
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw error;
  }
}

export async function getUserResources(
  projectId: string,
  identifier: string
): Promise<GetUserResourcesResp> {
  try {
    const client = new AcontextClient();
    return await client.getUserResources(projectId, identifier);
  } catch (error) {
    console.error("Failed to get user resources:", error);
    throw error;
  }
}
