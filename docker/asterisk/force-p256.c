#define _GNU_SOURCE
#include <openssl/ssl.h>
#include <openssl/obj_mac.h>
#include <dlfcn.h>
#include <stdio.h>

static void force_groups(SSL_CTX *ctx) {
    FILE *f=fopen("/tmp/force-p256.log","a"); if(f){fprintf(f,"force_groups called\n");fclose(f);}
    static long (*orig)(SSL_CTX *, int, long, void *) = NULL;
    if (!orig) orig = dlsym(RTLD_NEXT, "SSL_CTX_ctrl");
    int nid = NID_X9_62_prime256v1;
    orig(ctx, SSL_CTRL_SET_GROUPS, 1, (void *)&nid);
}

long SSL_CTX_ctrl(SSL_CTX *ctx, int cmd, long larg, void *parg) {
    static long (*orig)(SSL_CTX *, int, long, void *) = NULL;
    if (!orig) orig = dlsym(RTLD_NEXT, "SSL_CTX_ctrl");
    if (cmd == SSL_CTRL_SET_TMP_ECDH || cmd == SSL_CTRL_SET_GROUPS || cmd == SSL_CTRL_SET_GROUPS_LIST) {
        force_groups(ctx);
        return 1;
    }
    return orig(ctx, cmd, larg, parg);
}

#undef SSL_CTX_set_ecdh_auto
#undef SSL_CTX_set_tmp_ecdh
int SSL_CTX_set_ecdh_auto(SSL_CTX *ctx, int on_off) {
    force_groups(ctx);
    return 1;
}
int SSL_CTX_set_tmp_ecdh(SSL_CTX *ctx, void *key) {
    force_groups(ctx);
    return 1;
}
