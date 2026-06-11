// Direct-message helpers. All access goes through Supabase RLS — these
// just wrap the common queries so the UI stays tidy.

// Get the conversation id between the current user and `otherId`,
// creating it if it doesn't exist yet. Uses the SECURITY DEFINER
// get_or_create_conversation() RPC so the ordered (user_a,user_b) pair
// is created atomically.
export async function getOrCreateConversation(supabase, otherId) {
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    other_user: otherId,
  });
  if (error) throw error;
  return data; // conversation uuid
}

// Load the current user's conversations, most-recent first, with the
// other participant's profile and the last message preview attached.
export async function loadConversations(supabase, myId) {
  const { data: convos, error } = await supabase
    .from("conversations")
    .select(
      "id, user_a, user_b, last_message_at, user_a_read_at, user_b_read_at, " +
        "a:profiles!conversations_user_a_fkey(id, username, fursona_name, avatar_url), " +
        "b:profiles!conversations_user_b_fkey(id, username, fursona_name, avatar_url)"
    )
    .order("last_message_at", { ascending: false });

  if (error) throw error;

  // Normalize: expose `other` (the participant who isn't me) + read state.
  const withOther = (convos || []).map((c) => ({
    id: c.id,
    last_message_at: c.last_message_at,
    other: c.user_a === myId ? c.b : c.a,
    myReadAt: c.user_a === myId ? c.user_a_read_at : c.user_b_read_at,
  }));

  // Fetch the latest message for each conversation for a preview line.
  const ids = withOther.map((c) => c.id);
  if (ids.length) {
    const { data: lastMsgs } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at, sender_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });

    const seen = new Set();
    for (const m of lastMsgs || []) {
      if (seen.has(m.conversation_id)) continue;
      seen.add(m.conversation_id);
      const convo = withOther.find((c) => c.id === m.conversation_id);
      if (convo) convo.lastMessage = m;
    }
  }

  return withOther;
}

// Load all messages in a conversation, oldest first.
export async function loadMessages(supabase, conversationId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Send a message. Returns the inserted row.
export async function sendMessage(supabase, conversationId, senderId, content) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed,
    })
    .select("id, conversation_id, sender_id, content, created_at")
    .single();
  if (error) throw error;
  return data;
}

// Mark a conversation as read for the current user. Updates the
// user_a_read_at or user_b_read_at column depending on whether the
// current user is user_a or user_b.
export async function markConversationRead(supabase, conversationId, myId) {
  // Fetch the conversation to determine which column to update.
  const { data: convo } = await supabase
    .from("conversations")
    .select("user_a, user_b")
    .eq("id", conversationId)
    .single();
  if (!convo) return;

  const col = convo.user_a === myId ? "user_a_read_at" : "user_b_read_at";
  await supabase
    .from("conversations")
    .update({ [col]: new Date().toISOString() })
    .eq("id", conversationId);
}