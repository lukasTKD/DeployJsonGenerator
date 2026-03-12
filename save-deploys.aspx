<%@ Page Language="C#" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.Diagnostics" %>
<%@ Import Namespace="System.IO" %>
<%@ Import Namespace="System.Text" %>
<%@ Import Namespace="System.Text.RegularExpressions" %>
<%@ Import Namespace="System.Web" %>
<%@ Import Namespace="System.Web.Script.Serialization" %>

<script runat="server">
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
            var rawBody = ReadRawRequestBody();
            if (string.IsNullOrWhiteSpace(rawBody))
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Brak danych do zapisania."
                }, 400);
                return;
            }

            var scriptPath = Server.MapPath("~/save-deploys.ps1");
            if (!File.Exists(scriptPath))
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Nie znaleziono save-deploys.ps1."
                }, 500);
                return;
            }

            var psi = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -NoLogo -NonInteractive -ExecutionPolicy Bypass -File \"" + scriptPath + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WorkingDirectory = Path.GetDirectoryName(scriptPath) ?? AppDomain.CurrentDomain.BaseDirectory
            };

            psi.EnvironmentVariables["REQUEST_METHOD"] = "POST";
            psi.EnvironmentVariables["CONTENT_TYPE"] = Request.ContentType ?? "application/x-www-form-urlencoded; charset=UTF-8";

            using (var process = Process.Start(psi))
            {
                if (process == null)
                {
                    WriteJson(new
                    {
                        ok = false,
                        error = "Nie udalo sie uruchomic powershell.exe."
                    }, 500);
                    return;
                }

                process.StandardInput.Write(rawBody);
                process.StandardInput.Close();

                var stdout = process.StandardOutput.ReadToEnd();
                var stderr = process.StandardError.ReadToEnd();
                process.WaitForExit(120000);

                if (process.ExitCode != 0 && !string.IsNullOrWhiteSpace(stderr))
                {
                    WriteJson(new
                    {
                        ok = false,
                        error = stderr.Trim()
                    }, 500);
                    return;
                }

                RelayPowerShellResponse(stdout, stderr);
            }
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

    private string ReadRawRequestBody()
    {
        Request.InputStream.Position = 0;
        using (var reader = new StreamReader(Request.InputStream, Encoding.UTF8))
        {
            var body = reader.ReadToEnd();
            if (!string.IsNullOrWhiteSpace(body))
            {
                return body;
            }
        }

        var payload = (Request.Form["payload"] ?? "").Trim();
        if (string.IsNullOrWhiteSpace(payload))
        {
            return "";
        }

        return "payload=" + HttpUtility.UrlEncode(payload);
    }

    private void RelayPowerShellResponse(string stdout, string stderr)
    {
        var output = stdout ?? "";
        var statusCode = 200;
        var jsonBody = "";

        var statusMatch = Regex.Match(output, @"^Status:\s*(\d{3})", RegexOptions.Multiline);
        if (statusMatch.Success)
        {
            statusCode = SafeParseStatusCode(statusMatch.Groups[1].Value, 200);
            var separatorMatch = Regex.Match(output, @"\r?\n\r?\n");
            jsonBody = separatorMatch.Success
                ? output.Substring(separatorMatch.Index + separatorMatch.Length).Trim()
                : "";
        }
        else
        {
            jsonBody = output.Trim();
        }

        if (string.IsNullOrWhiteSpace(jsonBody))
        {
            WriteJson(new
            {
                ok = false,
                error = string.IsNullOrWhiteSpace(stderr) ? "Brak odpowiedzi ze skryptu save-deploys.ps1." : stderr.Trim()
            }, 500);
            return;
        }

        Response.Clear();
        Response.StatusCode = statusCode;
        Response.ContentType = "application/json";
        Response.TrySkipIisCustomErrors = true;
        Response.Write(jsonBody);
    }

    private int SafeParseStatusCode(string value, int fallback)
    {
        int parsed;
        return int.TryParse(value, out parsed) ? parsed : fallback;
    }

    private void WriteJson(object data, int statusCode)
    {
        Response.Clear();
        Response.StatusCode = statusCode;
        Response.ContentType = "application/json";
        Response.TrySkipIisCustomErrors = true;
        Response.Write(_serializer.Serialize(data));
    }
</script>
