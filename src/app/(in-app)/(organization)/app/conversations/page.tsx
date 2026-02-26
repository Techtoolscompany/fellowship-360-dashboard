"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { Search, Filter, MessageSquare, MessageCircle, Phone, Mail, MoreHorizontal, Clock, Loader2, Send, Bot, User, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { 
  getConversations, 
  getConversationStats, 
  updateConversationStatus,
  getConversationMessages,
  addMessage
} from "@/app/actions/communications";

const getChannelIcon = (channel: string) => {
  switch (channel) {
    case "phone": return <Phone className="w-4 h-4" />;
    case "sms": return <MessageCircle className="w-4 h-4" />;
    case "email": return <Mail className="w-4 h-4" />;
    default: return <MessageCircle className="w-4 h-4" />;
  }
};

export default function ConversationsPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  
  // Left Pane State
  const [conversationList, setConversationList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Right Pane State
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredConversations = conversationList.filter((row) => {
    const searchString = `${row.conversation.subject || ""} ${row.contact?.firstName || ""} ${row.contact?.lastName || ""}`.toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === "All") return true;
    return row.conversation.status === statusFilter.toLowerCase();
  });

  const fetchList = useCallback(async () => {
    if (!orgId) return;
    try {
      const [data, s] = await Promise.all([getConversations(orgId), getConversationStats(orgId)]);
      setConversationList(data);
      setStats(s);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoadingList(false);
    }
  }, [orgId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Load right pane messages when active changes
  useEffect(() => {
    if (!activeConversationId) return;
    const fetchActiveMessages = async () => {
      setLoadingMessages(true);
      try {
        const msgs = await getConversationMessages(activeConversationId);
        setMessages(msgs);
        
        // Find full object for header
        const fullConv = conversationList.find(c => c.conversation.id === activeConversationId);
        if (fullConv) setActiveConversation(fullConv);
        
      } catch (err) {
        console.error("Failed to load thread:", err);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchActiveMessages();
  }, [activeConversationId, conversationList]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleResolve = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await updateConversationStatus(id, "resolved");
      toast.success("Conversation marked as resolved");
      fetchList();
      if (activeConversationId === id) {
        setActiveConversation((prev: any) => prev ? { ...prev, conversation: { ...prev.conversation, status: 'resolved' } } : prev);
      }
    } catch (e) {
      toast.error("Failed to resolve conversation");
    }
  };

  const handleSendMessage = async () => {
    if (!composerText.trim() || !activeConversationId) return;
    setSendingMsg(true);
    try {
      // Optimistic upate
      const tempMsg = {
        id: "temp-" + Date.now(),
        content: composerText,
        direction: "outbound",
        senderType: "human",
        sentAt: new Date()
      };
      setMessages(prev => [...prev, tempMsg]);
      setComposerText("");

      await addMessage({
        conversationId: activeConversationId,
        content: tempMsg.content,
        direction: "outbound",
        senderType: "human"
      });
      
      // Refresh to get legit IDs
      const msgs = await getConversationMessages(activeConversationId);
      setMessages(msgs);
      fetchList(); // bump to top of list
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] pt-0 pb-2 max-w-[1600px] mx-auto overflow-hidden">
      
      {/* Header Strip */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0 px-2 mt-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Inbox</h1>
        </div>
        <div className="flex gap-2">
           {["All", "Open", "Waiting", "Resolved"].map((status) => (
            <Button 
              key={status}
              variant={statusFilter === status ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={statusFilter === status ? "bg-[#bbff00]/20 text-[#1a1d21] hover:bg-[#a8e600]/30 font-medium" : "text-muted-foreground transition-colors hover:text-foreground"}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden min-h-0 bg-background/40 rounded-2xl border border-border/40 shadow-sm relative">
        
        {/* LEFT PANE: List */}
        <div className="w-[380px] flex-shrink-0 border-r border-border/40 flex flex-col bg-card/20">
          <div className="p-4 border-b border-border/40 backdrop-blur-md bg-card/60 sticky top-0 z-10">
            <div className="relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors" />
              <input 
                type="text" 
                className="w-full pl-9 pr-4 py-2.5 bg-background/50 border border-input/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bbff00]/50 focus:border-[#bbff00]/50 transition-all placeholder:text-muted-foreground/70 shadow-sm" 
                placeholder="Search conversations..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loadingList ? (
              <div className="p-8 flex flex-col items-center justify-center text-muted-foreground space-y-4 h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Loading inbox...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
                 <div className="p-12 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-12 h-12 rounded-full bg-accent/30 shadow-sm border border-border/40 flex items-center justify-center mb-4">
                    <MessageCircle className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Inbox Zero</p>
                  <p className="text-sm text-muted-foreground mt-1">No matching conversations found.</p>
                </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredConversations.map((row) => {
                  const isActive = row.conversation.id === activeConversationId;
                  return (
                    <div 
                      key={row.conversation.id} 
                      onClick={() => setActiveConversationId(row.conversation.id)}
                      className={`p-3 rounded-xl cursor-pointer transition-all duration-200 group ${
                        isActive 
                          ? "bg-accent/60 shadow-sm ring-1 ring-border/50" 
                          : "hover:bg-accent/30 active:scale-[0.99]"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="relative mt-0.5 shrink-0">
                          <Avatar className="h-11 w-11 border border-border/40 shadow-sm">
                            <AvatarFallback className="bg-gradient-to-br from-muted to-muted/50 text-muted-foreground font-medium">
                              {row.contact?.firstName?.[0] || "?"}{row.contact?.lastName?.[0] || ""}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 border-background shadow-xs ${
                             row.conversation.channel === 'sms' ? 'bg-amber-100 text-amber-600' :
                             row.conversation.channel === 'email' ? 'bg-blue-100 text-blue-600' :
                             'bg-emerald-100 text-emerald-600'
                          }`}>
                            <div className="scale-[0.75]">{getChannelIcon(row.conversation.channel)}</div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className={`font-semibold truncate text-[15px] tracking-tight ${isActive ? 'text-foreground' : 'text-foreground/90'}`}>
                               {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "Unknown Caller"}
                            </span>
                            <span className={`text-[11px] font-medium whitespace-nowrap ml-2 shrink-0 ${isActive ? 'text-foreground/70' : 'text-muted-foreground/70 group-hover:text-muted-foreground'}`}>
                              {new Date(row.conversation.lastMessageAt || row.conversation.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                            </span>
                          </div>
                          <p className={`text-[13px] truncate leading-tight ${isActive ? 'text-foreground/80' : 'text-muted-foreground group-hover:text-foreground/70'}`}>
                            {row.conversation.subject || "No subject"}
                          </p>
                          {row.conversation.status !== 'open' && (
                             <div className="mt-2.5">
                               <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-md font-medium border-transparent ${row.conversation.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'}`}>
                                  {row.conversation.status}
                               </Badge>
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* RIGHT PANE: Thread */}
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-card/30 to-background">
          {!activeConversationId ? (
             <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
               <div className="w-20 h-20 rounded-2xl bg-accent/30 shadow-sm border border-border/40 flex items-center justify-center mb-6">
                 <MessageSquare className="w-8 h-8 text-foreground/40" />
               </div>
               <p className="text-xl font-semibold text-foreground tracking-tight">Your Inbox</p>
               <p className="text-[15px] mt-2 max-w-[280px] text-center text-muted-foreground/80 leading-relaxed">Select a conversation from the left to view the thread and reply.</p>
             </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="h-[76px] flex-shrink-0 border-b border-border/40 px-6 flex items-center justify-between backdrop-blur-xl bg-card/50 sticky top-0 z-20">
                 <div className="flex items-center gap-4">
                    <Avatar className="h-11 w-11 shadow-sm border border-border/40">
                        <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-medium">
                          {activeConversation?.contact?.firstName?.[0] || "?"}{activeConversation?.contact?.lastName?.[0] || ""}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-bold text-lg tracking-tight leading-none mb-1.5 flex items-center gap-2">
                          {activeConversation?.contact ? `${activeConversation.contact.firstName} ${activeConversation.contact.lastName}` : "Unknown Caller"}
                          {activeConversation?.conversation?.status === 'resolved' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-0.5" />
                          )}
                      </h2>
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground font-medium">
                         <span className="capitalize flex items-center gap-1.5">
                           <span className="opacity-70 scale-90">{getChannelIcon(activeConversation?.conversation?.channel)}</span>
                           {activeConversation?.conversation?.channel}
                         </span>
                         <span className="opacity-50">•</span>
                         <span className={
                           activeConversation?.conversation?.status === 'resolved' ? 'text-emerald-500' :
                           activeConversation?.conversation?.status === 'waiting' ? 'text-blue-500' :
                           'text-amber-500'
                         }>{activeConversation?.conversation?.status}</span>
                      </div>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    {activeConversation?.conversation?.status !== 'resolved' && (
                       <Button size="sm" variant="outline" className="h-9 font-medium shadow-sm transition-all hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:hover:bg-emerald-500/10 dark:hover:border-emerald-500/20" onClick={(e) => handleResolve(activeConversationId, e)}>
                         <CheckCircle2 className="w-4 h-4 mr-2" />
                         Resolve
                       </Button>
                    )}
                    {activeConversation?.contact?.id && (
                       <Button size="sm" variant="secondary" className="h-9 font-medium shadow-sm" onClick={() => router.push(`/app/contacts/${activeConversation.contact.id}`)}>
                         View Profile
                       </Button>
                    )}
                 </div>
              </div>

              {/* Thread Messages */}
              <ScrollArea className="flex-1 px-8 py-6" ref={scrollRef}>
                {loadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 pb-4 max-w-4xl mx-auto">
                    {messages.map((msg, i) => {
                      const isOutbound = msg.direction === 'outbound';
                      const isAI = msg.senderType === 'ai';
                      
                      return (
                        <div key={msg.id} className={`flex gap-4 max-w-[85%] group ${isOutbound ? 'ml-auto flex-row-reverse' : ''}`}>
                          
                          <div className="flex-shrink-0 mt-auto">
                            <Avatar className="h-8 w-8 shadow-sm ring-1 ring-border/20">
                               <AvatarFallback className={`${isOutbound ? (isAI ? 'bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/10 text-fuchsia-600' : 'bg-gradient-to-br from-[#bbff00]/30 to-[#bbff00]/10 text-[#1a1d21]') : 'bg-gradient-to-br from-muted to-muted/50'}`}>
                                 {isOutbound ? (isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />) : <User className="w-4 h-4 text-muted-foreground" />}
                               </AvatarFallback>
                            </Avatar>
                          </div>

                          <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} gap-1.5`}>
                            <div className="flex items-baseline gap-2 px-1">
                               <span className="text-[12px] font-semibold text-muted-foreground">
                                 {isOutbound ? (isAI ? 'Grace AI' : 'Team Member') : (activeConversation?.contact?.firstName || 'User')}
                               </span>
                               <span className="text-[11px] font-medium text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                 {new Date(msg.sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                            </div>
                            
                            <div className={`px-5 py-3 rounded-3xl text-[15px] whitespace-pre-wrap leading-relaxed shadow-sm ${
                              isOutbound 
                                ? isAI ? 'bg-fuchsia-500/10 text-foreground border border-fuchsia-500/20 rounded-br-sm' : 'bg-[#bbff00] text-[#1a1d21] rounded-br-sm border border-[#a8e600]/50'
                                : 'bg-card text-foreground border border-border/50 rounded-bl-sm'
                            }`}>
                              {msg.content}
                            </div>
                          </div>
                          
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Composer */}
              {activeConversation?.conversation?.status !== 'resolved' && (
                <div className="p-6 bg-background/80 border-t border-border/40 backdrop-blur-xl mt-auto shrink-0 z-10">
                  <div className="max-w-4xl mx-auto">
                    <div className="relative flex items-end shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] border border-input/60 bg-card/50 backdrop-blur-sm focus-within:ring-2 focus-within:ring-[#bbff00]/40 focus-within:border-[#bbff00]/50 focus-within:bg-card rounded-2xl overflow-hidden p-2 transition-all duration-200">
                      <textarea 
                        className="flex-1 max-h-[200px] min-h-[48px] bg-transparent border-0 resize-none px-4 py-3 text-[15px] focus:outline-none focus:ring-0 placeholder:text-muted-foreground/60 leading-relaxed"
                        placeholder="Type a message..."
                        value={composerText}
                        onChange={(e) => setComposerText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <div className="flex-shrink-0 p-2">
                         <Button 
                           size="icon"
                           disabled={!composerText.trim() || sendingMsg}
                           onClick={handleSendMessage}
                           className={`h-10 w-10 rounded-xl transition-all shadow-sm ${composerText.trim() ? 'bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600] active:scale-95' : 'bg-muted text-muted-foreground'}`}
                         >
                           {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                         </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 px-2">
                      <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 opacity-70">
                        <Lock className="w-3 h-3" /> Secure Thread
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 font-medium tracking-wide">
                        Press <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-muted border border-border/50 shadow-sm mx-1">Enter</kbd> to send, <kbd className="font-sans px-1.5 py-0.5 rounded-md bg-muted border border-border/50 shadow-sm mx-1">Shift + Enter</kbd> for new line
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {activeConversation?.conversation?.status === 'resolved' && (
                <div className="p-8 bg-background/80 border-t border-border/40 text-center flex-shrink-0 backdrop-blur-xl z-10">
                   <div className="max-w-md mx-auto">
                     <p className="text-[15px] text-muted-foreground mb-4 font-medium">This conversation was marked as resolved.</p>
                     <Button variant="outline" className="shadow-sm font-medium hover:bg-accent hover:text-foreground transition-all" onClick={() => updateConversationStatus(activeConversationId, "open").then(() => {
                        fetchList();
                        setActiveConversation((prev: any) => prev ? { ...prev, conversation: { ...prev.conversation, status: 'open' } } : prev);
                     })}>
                        Reopen Thread
                     </Button>
                   </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
}
