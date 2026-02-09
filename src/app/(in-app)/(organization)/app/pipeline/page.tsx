"use client";

import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MoreHorizontal,
  Users,
  Clock,
  Target,
  Calendar,
  CheckCircle,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Types
interface PipelineCard {
  id: string;
  name: string;
  lastContact: string;
  owner: string;
  nextAction: string;
  priority: "high" | "medium" | "low";
  source?: string;
}

interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  items: PipelineCard[];
}

type ColumnsState = Record<string, PipelineColumn>;

// Initial data
const initialColumns: ColumnsState = {
  new: {
    id: "new",
    title: "First-Time Visitors",
    color: "#3b82f6",
    items: [
      { id: "card-1", name: "Jennifer Martinez", lastContact: "Today", owner: "Pastor Mike", nextAction: "Feb 12", priority: "high", source: "Sunday Service" },
      { id: "card-2", name: "Carlos Rodriguez", lastContact: "Yesterday", owner: "Sarah L.", nextAction: "Feb 13", priority: "medium", source: "Website" },
      { id: "card-9", name: "Emily Watson", lastContact: "3 days ago", owner: "John D.", nextAction: "Feb 14", priority: "low", source: "Invite" },
    ],
  },
  attempted: {
    id: "attempted",
    title: "Attempted Contact",
    color: "#f59e0b",
    items: [
      { id: "card-3", name: "Amanda Chen", lastContact: "2 days ago", owner: "Pastor Mike", nextAction: "Feb 11", priority: "high", source: "Event" },
      { id: "card-10", name: "Robert Kim", lastContact: "4 days ago", owner: "Sarah L.", nextAction: "Feb 12", priority: "medium", source: "Sunday Service" },
    ],
  },
  connected: {
    id: "connected",
    title: "Connected",
    color: "#6366f1",
    items: [
      { id: "card-4", name: "David Kim", lastContact: "3 days ago", owner: "John D.", nextAction: "Feb 14", priority: "medium", source: "Small Group" },
      { id: "card-5", name: "Lisa Thompson", lastContact: "1 week ago", owner: "Sarah L.", nextAction: "Feb 12", priority: "low", source: "New Member Class" },
    ],
  },
  scheduled: {
    id: "scheduled",
    title: "Membership Class",
    color: "#10b981",
    items: [
      { id: "card-6", name: "Mark Wilson", lastContact: "Today", owner: "Pastor Mike", nextAction: "Feb 10", priority: "high", source: "Registration" },
      { id: "card-11", name: "Lisa Anderson", lastContact: "2 days ago", owner: "John D.", nextAction: "Feb 15", priority: "medium", source: "Registration" },
    ],
  },
  joined: {
    id: "joined",
    title: "New Members",
    color: "#84cc16",
    items: [
      { id: "card-7", name: "Rachel Green", lastContact: "2 weeks ago", owner: "John D.", nextAction: "Feb 15", priority: "low", source: "Completed Class" },
    ],
  },
  inactive: {
    id: "inactive",
    title: "Inactive / Lost",
    color: "#ef4444",
    items: [
      { id: "card-8", name: "Tom Bradley", lastContact: "1 month ago", owner: "Sarah L.", nextAction: "Overdue", priority: "high", source: "No Response" },
    ],
  },
};

const kpiStats = [
  { title: "In Pipeline", value: "38", subtitle: "active prospects", icon: Users },
  { title: "Avg Time to Join", value: "21 days", subtitle: "from first visit", icon: Calendar },
  { title: "Conversion Rate", value: "32%", subtitle: "visitor to member", icon: Target },
  { title: "Connected This Week", value: "12", subtitle: "+25% vs last week", icon: CheckCircle },
];

const priorityConfig = {
  high: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  low: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
};

export default function PipelinePage() {
  const [columns, setColumns] = useState<ColumnsState>(initialColumns);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];
    const sourceItems = [...sourceColumn.items];
    const destItems = source.droppableId === destination.droppableId ? sourceItems : [...destColumn.items];

    const [removed] = sourceItems.splice(source.index, 1);

    if (source.droppableId === destination.droppableId) {
      sourceItems.splice(destination.index, 0, removed);
      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, items: sourceItems },
      });
    } else {
      destItems.splice(destination.index, 0, removed);
      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, items: sourceItems },
        [destination.droppableId]: { ...destColumn, items: destItems },
      });
      toast.success(`Moved ${removed.name} to ${destColumn.title}`);
    }
  };

  const totalItems = Object.values(columns).reduce((sum, col) => sum + col.items.length, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">
            Track Visitor to Member Journey
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Engagement Pipeline
          </h1>
        </div>
        <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600] font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Add to Pipeline
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                  <p className="text-sm font-medium text-foreground/80">{stat.title}</p>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#bbff00]/15 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-[#7a9e00]" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Kanban Board */}
      {/* Pipeline Board Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pipeline Board</h2>
        <span className="text-sm text-muted-foreground">
          Drag and drop cards to move visitors between stages • {totalItems} total
        </span>
      </div>

      {/* Kanban Board — no wrapping Card to avoid nested scroll containers */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 pb-4">
              {Object.entries(columns).map(([columnId, column]) => (
                <div key={columnId} className="w-[280px] flex-shrink-0">
                  {/* Column Header */}
                  <div
                    className="rounded-t-lg px-3 py-2.5 flex items-center justify-between"
                    style={{ backgroundColor: `${column.color}15` }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: column.color }}
                      />
                      <span className="font-semibold text-sm">{column.title}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-xs h-5 px-1.5"
                      style={{ backgroundColor: `${column.color}20`, color: column.color }}
                    >
                      {column.items.length}
                    </Badge>
                  </div>

                  {/* Droppable Column */}
                  <Droppable droppableId={columnId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="border border-t-0 rounded-b-lg p-2 space-y-2 transition-colors duration-200"
                        style={{
                          minHeight: "400px",
                          backgroundColor: snapshot.isDraggingOver
                            ? `${column.color}08`
                            : "var(--color-card)",
                          borderColor: snapshot.isDraggingOver
                            ? column.color
                            : "var(--color-border)",
                        }}
                      >
                        {column.items.map((card, index) => (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="rounded-lg border border-border bg-card p-3 group transition-shadow"
                                style={{
                                  ...provided.draggableProps.style,
                                  boxShadow: snapshot.isDragging
                                    ? "0 8px 25px rgba(0, 0, 0, 0.15)"
                                    : "0 1px 3px rgba(0, 0, 0, 0.06)",
                                  transform: snapshot.isDragging
                                    ? `${provided.draggableProps.style?.transform} rotate(2deg)`
                                    : provided.draggableProps.style?.transform,
                                }}
                              >
                                {/* Card Header */}
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-semibold text-sm text-foreground">
                                    {card.name}
                                  </h4>
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priorityConfig[card.priority].bg} ${priorityConfig[card.priority].text}`}
                                  >
                                    {card.priority}
                                  </span>
                                </div>

                                {/* Source */}
                                {card.source && (
                                  <p className="text-xs text-muted-foreground mb-2">
                                    via {card.source}
                                  </p>
                                )}

                                {/* Card Footer */}
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {card.owner}
                                  </span>
                                  <span
                                    className={`flex items-center gap-1 ${card.nextAction === "Overdue" ? "text-red-500 font-bold" : ""}`}
                                  >
                                    <Calendar className="w-3 h-3" />
                                    {card.nextAction}
                                  </span>
                                </div>

                                {/* Last contact */}
                                <p className="text-[11px] text-muted-foreground/60 mt-1.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Last contact: {card.lastContact}
                                </p>

                                {/* Hover Actions */}
                                <div className="mt-2 pt-2 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>View Profile</DropdownMenuItem>
                                      <DropdownMenuItem>Add Note</DropdownMenuItem>
                                      <DropdownMenuItem>Schedule Follow-up</DropdownMenuItem>
                                      <DropdownMenuItem className="text-red-600">Remove</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
    </div>
  );
}
