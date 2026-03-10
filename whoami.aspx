<%@ Page Language="C#" %>
<%
    Response.ContentType = "application/json";
    Response.Cache.SetCacheability(HttpCacheability.NoCache);
    string user = HttpContext.Current.User.Identity.Name ?? "";
    Response.Write("{\"username\":\"" + user.Replace("\\", "\\\\") + "\"}");
%>
