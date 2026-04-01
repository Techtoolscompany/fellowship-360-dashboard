"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  SuperAdminEmptyState,
  SuperAdminInlineStat,
  SuperAdminPageHeader,
  SuperAdminSectionHeading,
  SuperAdminSurface,
  SuperAdminToolbar,
  SuperAdminToolbarGroup,
  superAdminInsetClassName,
} from "@/components/super-admin/primitives";
import { Inbox, Mail, Search, Trash2 } from "lucide-react";
import { SuperAdminPagination } from "@/components/super-admin/primitives";

interface Message {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface PaginationInfo {
  total: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
}

type StatusFilter = "all" | "unread" | "read";

function formatMessageDate(date: string) {
  return new Date(date).toLocaleString();
}

export default function MessagesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteCandidate, setDeleteCandidate] = useState<Message | null>(null);
  const limit = 10;

  const { data, error, isLoading } = useSWR<{
    messages: Message[];
    pagination: PaginationInfo;
  }>(`/api/super-admin/messages?page=${page}&limit=${limit}&search=${search}`);

  const messages = data?.messages ?? [];
  const refreshKey = `/api/super-admin/messages?page=${page}&limit=${limit}&search=${search}`;

  const filteredMessages = useMemo(() => {
    if (statusFilter === "all") return messages;
    return messages.filter((message) => (statusFilter === "unread" ? !message.readAt : !!message.readAt));
  }, [messages, statusFilter]);

  const unreadCount = useMemo(() => messages.filter((message) => !message.readAt).length, [messages]);
  const selectedMessage = selectedMessageId
    ? filteredMessages.find((message) => message.id === selectedMessageId) ??
      messages.find((message) => message.id === selectedMessageId) ??
      null
    : null;

  useEffect(() => {
    if (!filteredMessages.length) {
      setSelectedMessageId(null);
      return;
    }

    if (!selectedMessageId || !filteredMessages.some((message) => message.id === selectedMessageId)) {
      setSelectedMessageId(filteredMessages[0]?.id ?? null);
    }
  }, [filteredMessages, selectedMessageId]);

  const handleOpenMessage = async (message: Message) => {
    setSelectedMessageId(message.id);
    if (!message.readAt) {
      try {
        await fetch("/api/super-admin/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: message.id, readAt: true }),
        });
        mutate(refreshKey);
      } catch (requestError) {
        toast.error(requestError instanceof Error ? requestError.message : "Failed to update message");
      }
    }
  };

  const handleToggleRead = async (message: Message) => {
    try {
      await fetch("/api/super-admin/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: message.id, readAt: !message.readAt }),
      });
      mutate(refreshKey);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to update message");
    }
  };

  const handleDelete = async (message: Message) => {
    try {
      await fetch(`/api/super-admin/messages?id=${message.id}`, {
        method: "DELETE",
      });
      setDeleteCandidate(null);
      setSelectedMessageId((current) => (current === message.id ? null : current));
      mutate(refreshKey);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to delete message");
    }
  };

  const handleReply = (message: Message) => {
    window.location.href = `mailto:${message.email}?subject=Re: Message from ${message.name}&body=\n\n------------------\nOriginal message:\n${message.message}`;
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Inbox Pressure"
        eyebrowIcon={Inbox}
        title="Messages"
        description="Treat lead and support traffic like an operations inbox. Triage the queue, open the thread, and reply without falling back to CRUD-style rows."
        stats={[
          { label: "Total", value: data?.pagination.total ?? 0, detail: "Across all pages" },
          { label: "Unread", value: unreadCount, detail: "Current page queue" },
          { label: "Selected", value: selectedMessage ? 1 : 0, detail: selectedMessage ? selectedMessage.email : "No thread open" },
        ]}
      />

      <SuperAdminToolbar>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <SuperAdminToolbarGroup className="justify-between">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search sender, email, company, or message text..."
                className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Badge variant="outline" className="hidden shrink-0 lg:inline-flex">
              Page {page}
            </Badge>
          </SuperAdminToolbarGroup>

          <div className="grid gap-3 sm:grid-cols-3">
            <SuperAdminToolbarGroup>
              <div className="flex w-full items-center gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "unread" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setStatusFilter("unread")}
                >
                  Unread
                </Button>
                <Button
                  variant={statusFilter === "read" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setStatusFilter("read")}
                >
                  Read
                </Button>
              </div>
            </SuperAdminToolbarGroup>
            <SuperAdminInlineStat label="Visible Queue" value={filteredMessages.length} />
            <SuperAdminInlineStat label="Needs Reply" value={unreadCount} tone="warning" />
          </div>
        </div>
      </SuperAdminToolbar>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.2fr)]">
        <SuperAdminSurface className="overflow-hidden p-0">
          <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80">
            <SuperAdminSectionHeading
              eyebrow="Queue"
              title="Inbox threads"
              description="The left rail is the active queue for this page and filter set. Selecting a thread marks it read."
              action={<Badge variant="outline">{filteredMessages.length} threads</Badge>}
            />
          </div>

          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {isLoading ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading messages...
              </div>
            ) : error ? (
              <div className="px-5 py-10 text-center text-sm text-destructive">Error loading messages</div>
            ) : filteredMessages.length === 0 ? (
              <div className="px-5 py-10">
                <SuperAdminEmptyState
                  title="No messages found"
                  description="Try a broader search or switch the inbox filter to see the rest of the queue."
                  className="min-h-[220px]"
                />
              </div>
            ) : (
              filteredMessages.map((message) => {
                const isSelected = selectedMessage?.id === message.id;

                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => void handleOpenMessage(message)}
                    className={`w-full px-5 py-4 text-left transition-colors ${
                      isSelected
                        ? "bg-slate-100/85 dark:bg-slate-800/70"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-semibold text-slate-900 dark:text-white">
                            {message.name}
                          </div>
                          {!message.readAt ? <Badge>Unread</Badge> : <Badge variant="secondary">Read</Badge>}
                          {message.company ? <Badge variant="outline">{message.company}</Badge> : null}
                        </div>
                        <div className="truncate text-sm text-slate-500 dark:text-slate-400">{message.email}</div>
                        <div className="line-clamp-2 text-sm text-slate-700 dark:text-slate-200">
                          {message.message}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                        <div>{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SuperAdminSurface>

        <SuperAdminSurface className="p-0">
          <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80">
            <SuperAdminSectionHeading
              eyebrow="Thread"
              title={selectedMessage ? selectedMessage.name : "Message detail"}
              description={
                selectedMessage
                  ? selectedMessage.email
                  : "Select a thread from the queue to inspect the full message and take action."
              }
              action={
                selectedMessage ? (
                  <Badge variant={selectedMessage.readAt ? "secondary" : "default"}>
                    {selectedMessage.readAt ? "Read" : "Unread"}
                  </Badge>
                ) : undefined
              }
            />
          </div>

          {selectedMessage ? (
            <div className="space-y-6 p-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className={superAdminInsetClassName + " px-4 py-3"}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Received
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                    {formatMessageDate(selectedMessage.createdAt)}
                  </div>
                </div>
                <div className={superAdminInsetClassName + " px-4 py-3"}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Company
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                    {selectedMessage.company || "Not provided"}
                  </div>
                </div>
                <div className={superAdminInsetClassName + " px-4 py-3"}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Status
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                    {selectedMessage.readAt ? "Reviewed" : "Awaiting review"}
                  </div>
                </div>
              </div>

              <div className={superAdminInsetClassName + " p-5"}>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Message
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {selectedMessage.message}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-5 dark:border-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => void handleToggleRead(selectedMessage)}>
                    Mark as {selectedMessage.readAt ? "unread" : "read"}
                  </Button>
                  <AlertDialog
                    open={deleteCandidate?.id === selectedMessage.id}
                    onOpenChange={(open) => setDeleteCandidate(open ? selectedMessage : null)}
                  >
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteCandidate(selectedMessage)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete message</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete the thread from {selectedMessage.name}? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDelete(selectedMessage)}>
                          Delete message
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <Button onClick={() => handleReply(selectedMessage)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Reply by email
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-5">
              <SuperAdminEmptyState
                title="No thread selected"
                description="Choose a message from the inbox queue to see details and reply actions here."
                className="min-h-[320px]"
              />
            </div>
          )}
        </SuperAdminSurface>
      </div>

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
