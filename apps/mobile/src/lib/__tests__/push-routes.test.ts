import { describe, expect, it } from "vitest";

import { routeForNotificationData, routeForPushUrl } from "../push-routes";

describe("routeForPushUrl", () => {
  it.each([
    ["/messages/coach", "/chat/coach"],
    ["/admin/users/12/messages", "/chat/trainee/12"],
    ["/messages/groups/3", "/chat/group/3"],
    ["/admin/messages/groups/7", "/chat/group/7"],
    ["/messages/dm/5", "/chat/dm/5"],
    ["/post/9", "/post/9"],
    ["https://pt.example.com/post/9?x=1#y", "/post/9"],
    ["/notifications", "/notifications"],
  ])("%s opens %s", (url, expected) => {
    expect(routeForPushUrl(url)).toBe(expected);
  });

  it("falls back to the messages tab for anything unknown", () => {
    expect(routeForPushUrl("/something/else")).toBe("/(tabs)/messages");
    expect(routeForPushUrl("/messages/groups/abc")).toBe("/(tabs)/messages");
    expect(routeForPushUrl("/post/0")).toBe("/(tabs)/messages");
    expect(routeForPushUrl(undefined)).toBe("/(tabs)/messages");
  });

  it("reads the url from the notification data", () => {
    expect(routeForNotificationData({ url: "/messages/groups/3" })).toBe("/chat/group/3");
    expect(routeForNotificationData(null)).toBe("/(tabs)/messages");
  });
});
