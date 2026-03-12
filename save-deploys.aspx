<%@ Page Language="C#" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.Collections.Generic" %>
<%@ Import Namespace="System.IO" %>
<%@ Import Namespace="System.Text" %>
<%@ Import Namespace="System.Text.RegularExpressions" %>
<%@ Import Namespace="System.Web.Script.Serialization" %>

<script runat="server">
    public class SaveDeploysRequest
    {
        public string exportDate { get; set; }
        public string server { get; set; }
        public List<DeployFileRequest> files { get; set; }
    }

    public class DeployFileRequest
    {
        public string filename { get; set; }
        public string content { get; set; }
    }

    private static readonly string RootDir = @"D:\PROD_REPO_DATA\AutomateDeploy\Deploys";
    private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

    protected void Page_Load(object sender, EventArgs e)
    {
        Response.ContentType = "application/json";
        Response.Cache.SetCacheability(HttpCacheability.NoCache);
        Response.TrySkipIisCustomErrors = true;

        if (!string.Equals(Request.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
        {
            WriteJson(new
            {
                ok = false,
                error = "Uzyj metody POST."
            }, 405);
            return;
        }

        try
        {
            var payload = ReadPayload();
            if (payload == null || payload.files == null || payload.files.Count == 0)
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Brak plikow do zapisania."
                }, 400);
                return;
            }

            var exportDate = (payload.exportDate ?? "").Trim();
            if (!Regex.IsMatch(exportDate, @"^\d{4}-\d{2}-\d{2}$"))
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Niepoprawny format daty. Oczekiwano yyyy-MM-dd."
                }, 400);
                return;
            }

            var targetDir = Path.Combine(RootDir, exportDate);
            Directory.CreateDirectory(targetDir);

            var savedFiles = new List<string>();
            foreach (var file in payload.files)
            {
                if (file == null || string.IsNullOrWhiteSpace(file.filename))
                {
                    continue;
                }

                var safeName = SanitizeFileName(file.filename);
                if (string.IsNullOrWhiteSpace(safeName))
                {
                    continue;
                }

                if (!safeName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
                {
                    safeName += ".json";
                }

                var fullPath = Path.Combine(targetDir, safeName);
                File.WriteAllText(fullPath, file.content ?? "", new UTF8Encoding(false));
                savedFiles.Add(safeName);
            }

            if (savedFiles.Count == 0)
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Nie znaleziono poprawnych nazw plikow do zapisania."
                }, 400);
                return;
            }

            WriteJson(new
            {
                ok = true,
                directory = targetDir,
                saved = savedFiles.Count,
                files = savedFiles,
                server = payload.server ?? ""
            });
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

    private SaveDeploysRequest ReadPayload()
    {
        var formPayload = (Request.Form["payload"] ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(formPayload))
        {
            return _serializer.Deserialize<SaveDeploysRequest>(formPayload);
        }

        Request.InputStream.Position = 0;
        using (var reader = new StreamReader(Request.InputStream, Encoding.UTF8))
        {
            var body = reader.ReadToEnd();
            return string.IsNullOrWhiteSpace(body) ? null : _serializer.Deserialize<SaveDeploysRequest>(body);
        }
    }

    private string SanitizeFileName(string fileName)
    {
        var input = Path.GetFileName((fileName ?? "").Trim());
        if (string.IsNullOrWhiteSpace(input))
        {
            return "";
        }

        var invalidChars = Path.GetInvalidFileNameChars();
        var builder = new StringBuilder(input.Length);
        foreach (var ch in input)
        {
            builder.Append(Array.IndexOf(invalidChars, ch) >= 0 ? '_' : ch);
        }

        return builder.ToString().Trim();
    }

    private void WriteJson(object data, int statusCode = 200)
    {
        Response.Clear();
        Response.StatusCode = statusCode;
        Response.ContentType = "application/json";
        Response.TrySkipIisCustomErrors = true;
        Response.Write(_serializer.Serialize(data));
    }
</script>
