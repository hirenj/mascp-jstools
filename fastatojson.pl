#!/usr/bin/perl -w

open(FASTA,$ARGV[0]);

while(my $line = <FASTA>) {
    $line =~ s/\n$//;
    if ($line =~ s/^>// ) {
        if ($line !~ /^\s*$/) {
            print qq|{"data" : ["$line","","|;
        }
    } elsif ($line !~ /^\s*$/) {
        $line =~ s/\*$//;
        print qq|$line"]}\n|;
    }
}