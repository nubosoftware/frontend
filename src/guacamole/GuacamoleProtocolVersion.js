"use strict";


/**
 * Representation of a Guacamole protocol version. Convenience methods are
 * provided for parsing and comparing versions, as is necessary when
 * determining the version of the Guacamole protocol common to guacd and a
 * client.
 */
class GuacamoleProtocolVersion {

    /**
     * Protocol version 1.0.0 and older.  Any client that doesn't explicitly
     * set the protocol version will negotiate down to this protocol version.
     * This requires that handshake instructions be ordered correctly, and
     * lacks support for certain protocol-related features introduced in later
     * versions.
     */
    static VERSION_1_0_0 = new GuacamoleProtocolVersion(1, 0, 0);

    /**
     * Protocol version 1.1.0, which introduces Client-Server version
     * detection, arbitrary handshake instruction order, and support
     * for passing the client timezone to the server during the handshake.
     */
    static VERSION_1_1_0 = new GuacamoleProtocolVersion(1, 1, 0);

    /**
     * Protocol version 1.3.0, which introduces the "required" instruction
     * allowing the server to explicitly request connection parameters from the
     * client.
     */
    static VERSION_1_3_0 = new GuacamoleProtocolVersion(1, 3, 0);

    /**
     * The most recent version of the Guacamole protocol at the time this
     * version of GuacamoleProtocolVersion was built.
     */
    static LATEST = GuacamoleProtocolVersion.VERSION_1_3_0;


    /**
     * A regular expression that matches the VERSION_X_Y_Z pattern, where
     * X is the major version component, Y is the minor version component,
     * and Z is the patch version component.  This expression puts each of
     * the version components in their own group so that they can be easily
     * used later.
     */
    static VERSION_PATTERN = new RegExp("^VERSION_([0-9]+)_([0-9]+)_([0-9]+)$");

    /**
    * The major version component of the protocol version.
    */
    major;

    /**
    * The minor version component of the protocol version.
    */
    minor;

    /**
    * The patch version component of the protocol version.
    */
    patch;

    /**
    * Generate a new GuacamoleProtocolVersion object with the given
    * major version, minor version, and patch version.
    * 
    * @param major
    *     The integer representation of the major version component.
    * 
    * @param minor
    *     The integer representation of the minor version component.
    * 
    * @param patch 
    *     The integer representation of the patch version component.
    */
    constructor(major, minor, patch) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    /**
     * Returns whether this GuacamoleProtocolVersion is at least as recent as
     * (greater than or equal to) the given version.
     *
     * @param {GuacamoleProtocolVersion} otherVersion
     *     The version to which this GuacamoleProtocolVersion should be compared.
     * 
     * @return 
     *     true if this object is at least as recent as the given version,
     *     false if the given version is newer.
     */
    atLeast(otherVersion) {

        // If major is not the same, return inequality
        if (this.major != otherVersion.major)
            return this.major > otherVersion.major;

        // Major is the same, but minor is not, return minor inequality
        if (this.minor != otherVersion.minor)
            return this.minor > otherVersion.minor;

        // Major and minor are equal, so return patch inequality
        return this.patch >= otherVersion.patch;
    }


    toString() {
        return "VERSION_" + this.major + "_" + this.minor + "_" + this.patch;
    }

    /**
     * Parse the String format of the version provided and return the
     * the enum value matching that version.  If no value is provided, return
     * null.
     * 
     * @param {String } version
     *     The String format of the version to parse.
     * 
     * @return {GuacamoleProtocolVersion}
     *     The enum value that matches the specified version, VERSION_1_0_0
     *     if no match is found, or null if no comparison version is provided.
     */
    static parseVersion(version) {

        // Validate format of version string
        let m = version.match(GuacamoleProtocolVersion.VERSION_PATTERN);
        if (!m) {
            return null;
        }
        return new GuacamoleProtocolVersion(
            parseInt(m[1]),
            parseInt(m[2]),
            parseInt(m[3])
        );
        /*
        Matcher versionMatcher = VERSION_PATTERN.matcher(version);
        if (!versionMatcher.matches())
            return null;

        // Parse version number from version string
        return new GuacamoleProtocolVersion(
            Integer.parseInt(versionMatcher.group(1)),
            Integer.parseInt(versionMatcher.group(2)),
            Integer.parseInt(versionMatcher.group(3))
        );*/

    }
}

module.exports = GuacamoleProtocolVersion;