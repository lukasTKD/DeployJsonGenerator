<%@ Page Language="C#" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.IO" %>
<%@ Import Namespace="System.Linq" %>
<%@ Import Namespace="System.Text" %>
<%@ Import Namespace="System.Text.RegularExpressions" %>
<%@ Import Namespace="System.Web" %>
<%@ Import Namespace="System.Web.Script.Serialization" %>

<script runat="server">
    private static readonly string DeployRoot = @"D:\PROD_REPO_DATA\AutomateDeploy\Deploys";
    private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

    protected void Page_Load(object sender, EventArgs e)
    {
        Response.ContentType = "application/json";
        Response.ContentEncoding = Encoding.UTF8;
        Response.Cache.SetCacheability(HttpCacheability.NoCache);
        Response.TrySkipIisCustomErrors = true;

        if (!string.Equals(Request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
        {
            WriteJson(new
            {
                ok = false,
                error = "Uzyj metody GET."
            }, 405);
            return;
        }

        try
        {
            var exportDate = (Request.QueryString["exportDate"] ?? "").Trim();
            if (!Regex.IsMatch(exportDate, @"^\d{4}-\d{2}-\d{2}$"))
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Niepoprawny format daty. Oczekiwano yyyy-MM-dd."
                }, 400);
                return;
            }

            var targetDir = Path.Combine(DeployRoot, exportDate);
            if (!Directory.Exists(targetDir))
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Nie znaleziono katalogu dla wybranej daty.",
                    directory = targetDir
                }, 404);
                return;
            }

            var files = Directory
                .GetFiles(targetDir, "*.json", SearchOption.TopDirectoryOnly)
                .OrderBy(Path.GetFileName, StringComparer.OrdinalIgnoreCase)
                .Select(path => new
                {
                    filename = Path.GetFileName(path),
                    content = File.ReadAllText(path, Encoding.UTF8)
                })
                .ToArray();

            WriteJson(new
            {
                ok = true,
                directory = targetDir,
                count = files.Length,
                files
            }, 200);
        }
        catch (Exception ex)
        {
            WriteJson(new
            {
                ok = false,
                error = ex.Message
            }, 500);
        }
    }

    private void WriteJson(object data, int statusCode)
    {
        Response.Clear();
        Response.StatusCode = statusCode;
        Response.ContentType = "application/json";
        Response.ContentEncoding = Encoding.UTF8;
        Response.TrySkipIisCustomErrors = true;
        Response.Write(_serializer.Serialize(data));
    }
</script>
