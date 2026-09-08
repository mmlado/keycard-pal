package com.keycardpal

import com.facebook.react.ReactPackage
import com.reactnativecommunity.netinfo.NetInfoPackage
import com.walletconnect.reactnativemodule.RNWalletConnectModulePackage

/**
 * Native modules linked only into the full flavor.
 *
 * react-native.config.js keeps these packages out of autolinking so the offline flavor never
 * ships them (#270). This list is the full flavor's replacement for the PackageList entries
 * autolinking would have generated; the offline flavor's twin returns nothing.
 */
fun onlineNativePackages(): List<ReactPackage> =
    listOf(
        RNWalletConnectModulePackage(),
        NetInfoPackage(),
    )
