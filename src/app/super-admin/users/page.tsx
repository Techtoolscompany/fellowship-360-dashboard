"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SuperAdminPageHeader,
  SuperAdminPagination,
  SuperAdminTableShell,
  SuperAdminToolbar,
} from "@/components/super-admin/primitives";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
}

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 10;

  const { data, error, isLoading } = useSWR<{
    users: User[];
    pagination: PaginationInfo;
  }>(`/api/super-admin/users?page=${page}&limit=${limit}&search=${search}`);

  const users = data?.users ?? [];
  const namedUsers = useMemo(() => users.filter((user) => Boolean(user.name)).length, [users]);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Admins And Access"
        eyebrowIcon={Users}
        title="Users"
        description="Inspect the people inside Fellowship 360, then jump into user-level impersonation and organization membership detail."
        stats={[
          { label: "Total", value: data?.pagination.total ?? 0, detail: "Across the platform" },
          { label: "On This Page", value: users.length, detail: `${namedUsers} named` },
          { label: "Page", value: page, detail: `10 per page` },
        ]}
      />

      <SuperAdminToolbar>
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            className="pl-9 border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </SuperAdminToolbar>

      <SuperAdminTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[320px]">User</TableHead>
              <TableHead className="min-w-[140px]">Joined</TableHead>
              <TableHead className="min-w-[180px]">User ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-destructive">
                  Error loading users
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-200/80 dark:border-slate-700">
                        <AvatarImage src={user.image || undefined} />
                        <AvatarFallback>
                          {user.name ? getInitials(user.name) : user.email?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <Link
                          href={`/super-admin/users/${user.id}`}
                          className="font-semibold text-slate-900 hover:text-slate-700 hover:underline dark:text-white dark:hover:text-slate-200"
                        >
                          {user.name || "Unnamed User"}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-slate-600 dark:text-slate-300">
                    {user.id}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SuperAdminTableShell>

      {data?.pagination ? (
        <SuperAdminPagination
          page={page}
          pageSize={limit}
          total={data.pagination.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
