#!/usr/bin/perl

use CGI;
require HTTP::Request;
require HTTP::Headers;
require LWP::UserAgent;
require HTML::Tidy;
require Digest::MD5;
use File::Spec;


my $method = $ENV{REQUEST_METHOD};

my $data;

print STDERR "In a request";

if ($method eq 'POST') {    
	$tmpStr;
	read( STDIN, $tmpStr, $ENV{ "CONTENT_LENGTH" } );
	$data = $tmpStr;
	print STDERR "In a POST request";
	print STDERR "${method}";
	print STDERR "Data is ${data}";
} else {
    print STDERR "GET request";
	$data = $ENV{'QUERY_STRING'};
	print STDERR "Data is ${data}";
}

my $cgi = new CGI($data);

my $URLS = {
  'phosphat' => 'http://phosphat.mpimp-golm.mpg.de/PhosPhAtHost30/productive/views/Prediction.php',
  'suba'     => 'http://suba.plantenergy.uwa.edu.au/services/byAGI.php',
  'promex'   => 'http://www.promexdb.org/cgi-bin/peplib.pl',
  'atproteome' => 'http://fgcz-atproteome.unizh.ch/index.php',
  'atproteome-json' => 'http://fgcz-atproteome.unizh.ch/mascpv2.php',
  'tair'    => 'http://www.arabidopsis.org/servlets/TairObject',
  'ppdb'    => 'http://ppdb.tc.cornell.edu/das/arabidopsis/features/',
};

my $tidy = {
    'promex' => true,
    'atproteome' => true,
    'tair' => true,
    'ppdb' => 'xml'
};

my $service = $cgi->param('service');

my $url = $URLS->{$cgi->param('service')};

my $hash = Digest::MD5->new();

$hash->add($service);
$hash->add($data);

print STDERR "Determined service is ${service}";

my $tmpdir = File::Spec->tmpdir();
my $cached = File::Spec->catfile($tmpdir,"masc-".$hash->hexdigest);

print STDERR "Looking for cached file ${cached}";

if ( -e $cached )
{
    if ($tidy->{$service}) {
        print CGI->header(-Content_type => 'application/xml',-Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');        
    } else {
        print CGI->header(-Content_type => 'text/plain', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');
    }
    undef $/;
    open $infile, "<".$cached;
    my $buf = <$infile>;
    print $buf;
    close $infile;
    exit;
}


my $request;
if ($method eq 'GET') {
    $request = HTTP::Request->new('GET', "${url}?${data}");
} else {
    $request = HTTP::Request->new('POST', $url,new HTTP::Headers( Content_Type => 'application/x-www-form-urlencoded' ),$data);
}


if ($tidy->{$service} eq 'xml') {
    print CGI->header(-Content_type => 'application/xml',-Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');
    my $start_content = LWP::UserAgent->new->request($request)->content;
    my $cleaned = $start_content;
    print $cleaned;
    $cleaned =~ s/nbsp//mgi;
    $cleaned =~ s/\&/&amp;/mgi;
    open $outfile, ">".$cached;
    print $outfile $cleaned;
    close $outfile;    
} elsif ($tidy->{$service}) {
    print CGI->header(-Content_type => 'application/xml',-Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');
    my $tidyer = HTML::Tidy->new( { output_xml => 1, add_xml_decl => 1 });
    my $start_content = LWP::UserAgent->new->request($request)->content;
    my $repl_doctype = qq|<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">|;
    $start_content =~ s/<\!DOCTYPE[^>]+>/TEMP_DTYPE/mi;
    $start_content =~ s/<\!DOCTYPE[^>]+>//mi;
    $start_content =~ s/TEMP_DTYPE/$repl_doctype/mi;
    $start_content =~ s/nbsp//mgi;
    my $cleaned = $tidyer->clean( $start_content );
    print $cleaned;
#    $cleaned = 'Foo';
    $cleaned =~ s/nbsp//mgi;
    open $outfile, ">".$cached;
    print $outfile $cleaned;
    close $outfile;
} else {
    print CGI->header(-Content_type => 'text/plain', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');
    my $content = LWP::UserAgent->new->request($request)->content;    
    print $content;
    open $outfile, ">".$cached;
    print $outfile $content;
    close $outfile;

}