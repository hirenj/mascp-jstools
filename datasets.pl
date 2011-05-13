#!/usr/bin/perl -w

use CGI;
use File::stat;


my $cgi = new CGI();

if ($cgi->request_method()) {
    print $cgi->header(-Content_type => 'application/json', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');
}

my $agi = uc( $cgi->param('agi') || '');
my $dataset = uc( $cgi->param('dataset') || '');

my $filename;

if (! $agi && ! $dataset) {
    my $foo = `ls -1 ../data/*.csv`;
    print "[".(join ",", sort map { $_ =~ s/\.csv//g; $_ =~ s/.+\///g; "\"$_\""; } split /\n/, $foo)."]\n";
    exit;
}

if ($dataset =~ /^[A-Za-z0-9]/) {
    unless (-e "../data/$dataset.csv") {
        exit;
    }
    unless (-e "$dataset.json" && (stat("../data/$dataset.csv")->mtime <= stat("$dataset.json")->mtime) ) {
        system(qq#awk -F',' 'BEGIN { print "["; }{ myagi = (\$1 ~ /^[Aa]/) ? \$1 : lastagi; if (myagi != lastagi) { if (lastagi) print "\\"\\"]}\\n,"; printf "{\\"agi\\":\\"" toupper(myagi) "\\", \\"peptides\\":["; } lastagi = myagi; printf "\\"" \$2 "\\"," } END { print "\\"\\"]}\\n]" }' ../data/$dataset.csv > $dataset.json#);
        system(qq#sed -i '' -e's/,""//' $dataset.json#);
    }
    $filename = "$dataset.json";
}

if ( $agi =~ /^AT[0-9A-Z]G\d+\.\d+/) {
    my $command = "fgrep -m1 '{\"agi\":\"$agi\"' $filename";
    my $grepped = `$command`;
    print $grepped;
}