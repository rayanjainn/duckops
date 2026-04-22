// Wipe workspaces older than 3 days on startup to keep jenkinsdata volume lean.
// Runs once at Jenkins init — not a recurring job.
import jenkins.model.Jenkins
import java.nio.file.Files
import java.time.Instant
import java.time.temporal.ChronoUnit

def wsRoot = new File(Jenkins.instance.rootDir, "workspace")
if (!wsRoot.exists()) return

def cutoff = Instant.now().minus(3, ChronoUnit.DAYS).toEpochMilli()
wsRoot.listFiles()?.each { dir ->
    if (dir.isDirectory() && dir.lastModified() < cutoff) {
        dir.deleteDir()
        println "Cleaned workspace: ${dir.name}"
    }
}
