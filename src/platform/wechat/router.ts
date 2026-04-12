// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat #tag router — maps #ProjectName tags to virtual project bots.
 */

import type { ManagedBot, PoolBot } from "../../types.js";

export type TagRoute = { managed: ManagedBot; config: PoolBot };

export class WeChatRouter {
  private routes = new Map<string, TagRoute>();
  private masterRoute: TagRoute | null = null;
  /** Tracks last used project per user for untagged messages */
  private lastProject = new Map<string, string>();

  /** Register a project bot with a tag. */
  register(tag: string, managed: ManagedBot, config: PoolBot): void {
    this.routes.set(tag.toLowerCase(), { managed, config });
  }

  /** Register the master bot. */
  registerMaster(managed: ManagedBot, config: PoolBot): void {
    this.masterRoute = { managed, config };
  }

  /**
   * Resolve a tag to a route.
   * - If tag is provided and matches a project → return that project
   * - If tag is null → return last used project for this user, or master
   * - Master command keywords (menu, config, bots, etc.) → always master
   */
  resolve(
    tag: string | null,
    userId: string,
    text: string,
  ): TagRoute | null {
    // Master commands always go to master
    const stripped = text.replace(/^\//, "");
    if (
      /^(menu|help|start|setup|bots|config|users|status|restart|search\s|cron\s)/i.test(
        stripped,
      )
    ) {
      return this.masterRoute;
    }

    if (tag) {
      const route = this.routes.get(tag.toLowerCase());
      if (route) {
        this.lastProject.set(userId, tag.toLowerCase());
        return route;
      }
      // Unknown tag — tell user
      return null;
    }

    // No tag — use last project or master
    const last = this.lastProject.get(userId);
    if (last && this.routes.has(last)) {
      return this.routes.get(last)!;
    }
    return this.masterRoute;
  }

  /** List all registered project tags. */
  listTags(): string[] {
    return [...this.routes.keys()];
  }
}
