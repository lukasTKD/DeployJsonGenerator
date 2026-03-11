<%@ Page Language="C#" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.IO" %>
<%@ Import Namespace="System.Text" %>

<script runat="server">
    private static readonly object _logLock = new object();
    private static readonly string _logDir = @"D:\PROD_REPO_DATA\IIS\DeployJsonGenerator";
    private static readonly string _logFile = Path.Combine(_logDir, "userActivity.log");

    protected void Page_Load(object sender, EventArgs e)
    {
        Response.ContentType = "application/json";
        Response.Cache.SetCacheability(HttpCacheability.NoCache);
        Response.TrySkipIisCustomErrors = true;

        try
        {
            var user = "anonymous";
            if (HttpContext.Current != null &&
                HttpContext.Current.User != null &&
                HttpContext.Current.User.Identity != null &&
                !string.IsNullOrWhiteSpace(HttpContext.Current.User.Identity.Name))
            {
                user = HttpContext.Current.User.Identity.Name;
            }

            var server = (Request.QueryString["server"] ?? "").Trim();
            var eventType = (Request.QueryString["event"] ?? "UNKNOWN").Trim();
            var eventData = (Request.QueryString["data"] ?? "").Replace(Environment.NewLine, " ").Replace("\t", " ").Trim();

            if (!Directory.Exists(_logDir))
            {
                Directory.CreateDirectory(_logDir);
            }

            var logLine = string.Format(
                "{0}\t{1}\t{2}\t{3}\t{4}",
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"),
                user,
                server,
                eventType,
                eventData
            );

            lock (_logLock)
            {
                File.AppendAllText(_logFile, logLine + Environment.NewLine, Encoding.UTF8);
            }

            Response.Write("{\"status\":\"ok\"}");
        }
        catch (Exception ex)
        {
            Response.StatusCode = 500;
            Response.Write("{\"status\":\"error\",\"message\":\"" + (ex.Message ?? "").Replace("\"", "'") + "\"}");
        }
    }
</script>
