package com.pastryuniverse.storage;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.Resource;

/** Where uploaded files (payment receipts, later product photos) are kept. */
public interface FileStorage {

    /** Saves the stream and returns the key to load it again. */
    String save(String folder, String extension, InputStream in) throws IOException;

    Resource load(String key);
}
