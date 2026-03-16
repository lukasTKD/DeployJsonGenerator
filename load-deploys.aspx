<%@ Page Language="C#" %>
<%@ Import Namespace="System.Collections.Generic" %>
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

            var files = new List<object>();
            var readErrors = new List<object>();

            foreach (var path in Directory
                .EnumerateFiles(targetDir, "*.json", SearchOption.AllDirectories)
                .OrderBy(filePath => GetRelativePath(targetDir, filePath), StringComparer.OrdinalIgnoreCase))
            {
                var relativePath = GetRelativePath(targetDir, path);

                try
                {
                    files.Add(new
                    {
                        filename = Path.GetFileName(path),
                        relativePath,
                        content = ReadFileText(path)
                    });
                }
                catch (Exception fileEx)
                {
                    readErrors.Add(new
                    {
                        filename = Path.GetFileName(path),
                        relativePath,
                        error = fileEx.Message
                    });
                }
            }

            WriteJson(new
            {
                ok = true,
                directory = targetDir,
                count = files.Count,
                totalFound = files.Count + readErrors.Count,
                files = files.ToArray(),
                readErrors = readErrors.ToArray()
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

    private string ReadFileText(string path)
    {
        using (var reader = new StreamReader(path, Encoding.UTF8, true))
        {
            return reader.ReadToEnd();
        }
    }

    private string GetRelativePath(string rootDir, string fullPath)
    {
        if (string.IsNullOrEmpty(rootDir) || string.IsNullOrEmpty(fullPath))
        {
            return Path.GetFileName(fullPath) ?? "";
        }

        if (!fullPath.StartsWith(rootDir, StringComparison.OrdinalIgnoreCase))
        {
            return Path.GetFileName(fullPath) ?? fullPath;
        }

        return fullPath
            .Substring(rootDir.Length)
            .TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }
</script>
