
## Build apt

### Prerequisite

```bash
sudo apt install triehash
sudo apt install libdb5.3-dev
sudo apt install gnutls-bin
sudo apt install libgnutls-dev
sudo apt install libgnutls
sudo apt install gnutls-dev
sudo apt install libbz2-dev
sudo apt install liblz4-dev 
sudo apt install libgcrypt-dev
sudo apt install libxxhash-dev
sudo apt install docbook-xsl 
sudo apt install gtest-dev
sudo apt install libgtest-dev
```

## Debian Repo structure

In `/etc/apt/source.list`, there are lines like
```
deb http://us.archive.ubuntu.com/ubuntu/ focal main restricted
```

Meaning:
```
deb [ option1=value1 option2=value2 ] uri suite [component1] [component2] [...]
deb-src [ option1=value1 option2=value2 ] uri suite [component1] [component2] [...]
```

Run `lynx http://us.archive.ubuntu.com/ubuntu/dists/focal/`

```
[   ]	Contents-amd64.gz	2020-04-23 04:34	39M
[   ]	Contents-i386.gz	2020-04-23 05:33	31M
[   ]	InRelease		2020-04-23 17:34	259K
[   ]	Release	2020-04-23 17:34	257K
[   ]	Release.gpg		2020-04-23 17:34	1.5K
[DIR]	by-hash/		2019-10-18 10:50	-
[DIR]	main/			2020-04-02 06:18	-
[DIR]	multiverse/		2020-04-02 06:18	-
[DIR]	restricted/		2020-04-02 06:18	-
[DIR]	universe/		2020-04-02 06:18	-
```



## An `apt install`

```
sudo apt install lynx            
[sudo] password for anfernee: 
Reading package lists... Done
Building dependency tree       
Reading state information... Done
The following packages were automatically installed and are no longer required:
  bridge-utils libclang-cpp14 libfwupdplugin1 libllvm14 llvm-14 llvm-14-dev llvm-14-linker-tools llvm-14-runtime llvm-14-tools python3-crcmod shim ubuntu-fan
Use 'sudo apt autoremove' to remove them.
The following additional packages will be installed:
  lynx-common
The following NEW packages will be installed:
  lynx lynx-common
0 upgraded, 2 newly installed, 0 to remove and 76 not upgraded.
Need to get 1,539 kB of archives.
After this operation, 5,481 kB of additional disk space will be used.
Do you want to continue? [Y/n] 
Get:1 http://us.archive.ubuntu.com/ubuntu focal/universe amd64 lynx-common all 2.9.0dev.5-1 [914 kB]
Get:2 http://us.archive.ubuntu.com/ubuntu focal/universe amd64 lynx amd64 2.9.0dev.5-1 [626 kB]
Fetched 1,539 kB in 1s (1,222 kB/s)
Selecting previously unselected package lynx-common.
(Reading database ... 408912 files and directories currently installed.)
Preparing to unpack .../lynx-common_2.9.0dev.5-1_all.deb ...
Unpacking lynx-common (2.9.0dev.5-1) ...
Selecting previously unselected package lynx.
Preparing to unpack .../lynx_2.9.0dev.5-1_amd64.deb ...
Unpacking lynx (2.9.0dev.5-1) ...
Setting up lynx-common (2.9.0dev.5-1) ...
Setting up lynx (2.9.0dev.5-1) ...
update-alternatives: using /usr/bin/lynx to provide /usr/bin/www-browser (www-browser) in auto mode
Processing triggers for man-db (2.9.1-1) ...
Processing triggers for mime-support (3.64ubuntu1) ...
```
