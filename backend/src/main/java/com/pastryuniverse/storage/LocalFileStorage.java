package com.pastryuniverse.storage;

import com.pastryuniverse.config.AppProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/** Stores files on disk. In Docker, mount a volume at the upload directory. */
@Component
public class LocalFileStorage implements FileStorage {

    private final Path root;

    public LocalFileStorage(AppProperties props) throws IOException {
        this.root = Path.of(props.uploadDir() == null ? "./data/uploads" : props.uploadDir()).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    @Override
    public String save(String folder, String extension, InputStream in) throws IOException {
        String key = folder + "/" + UUID.randomUUID() + "." + extension;
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        return key;
    }

    @Override
    public Resource load(String key) {
        return new FileSystemResource(resolve(key));
    }

    private Path resolve(String key) {
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) throw new IllegalArgumentException("Bad storage key");
        return p;
    }
}
