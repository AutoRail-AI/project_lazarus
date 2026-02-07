import { supabase } from "@/lib/db"
import type { Database, NotificationType } from "@/lib/db/types"
import { queueEmail } from "@/lib/queue"

export type Notification = Database["public"]["Tables"]["notifications"]["Row"]

// Create notification
export async function createNotification(data: {
  userId: string
  organizationId?: string
  type: NotificationType
  title: string
  message: string
  link?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
  sendEmail?: boolean
}): Promise<Notification | null> {
  const { data: notification, error } = await (supabase as any)
    .from("notifications")
    .insert({
      user_id: data.userId,
      organization_id: data.organizationId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      metadata: data.metadata,
      read: false,
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create notification:", error)
    return null
  }

  // Send email if requested
  if (data.sendEmail) {
    // Get user email from Better Auth table (assuming 'user' table exists)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user } = await (supabase as any)
      .from("user")
      .select("email")
      .eq("id", data.userId)
      .single()

    if (user?.email) {
      await queueEmail({
        to: user.email,
        subject: data.title,
        body: `
          <h2>${data.title}</h2>
          <p>${data.message}</p>
          ${data.link ? `<p><a href="${data.link}">View Details</a></p>` : ""}
        `,
      })
    }
  }

  return notification
}

// Get notifications
export async function getNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean
    limit?: number
    organizationId?: string
  } = {}
): Promise<Notification[]> {
  let query = (supabase as any)
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(options.limit || 50)

  if (options.unreadOnly) {
    query = query.eq("read", false)
  }
  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId)
  }

  const { data, error } = await query

  if (error) {
    console.error("Failed to fetch notifications:", error)
    return []
  }

  return data
}

// Mark as read
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId)

  if (error) {
    console.error("Failed to mark notification as read:", error)
  }
}

// Mark all as read
export async function markAllAsRead(
  userId: string,
  organizationId?: string
): Promise<void> {
  let query = (supabase as any)
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const { error } = await query

  if (error) {
    console.error("Failed to mark all notifications as read:", error)
  }
}

// Get unread count
export async function getUnreadCount(
  userId: string,
  organizationId?: string
): Promise<number> {
  let query = (supabase as any)
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)

  if (organizationId) {
    query = query.eq("organization_id", organizationId)
  }

  const { count, error } = await query

  if (error) {
    console.error("Failed to get unread count:", error)
    return 0
  }

  return count || 0
}
