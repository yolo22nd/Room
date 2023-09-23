package com.company.Objects;

import com.company.Base;

import java.util.Scanner;

public class BookShelf extends Base {
    public String object = " Shelf  ";
    public static String name = "a Bookshelf";
    public static int position=-10;


    public static void openShelf() {
        System.out.println("you have just opened the bookshelf");
        System.out.println("there are plenty of(6) books in here to read");
        Scanner scanner = new Scanner(System.in);
        System.out.println("type 'read' to read any of the books");
        System.out.println("type 'close' to close the shelf");
        label:
        while (true){
            switch (scanner.nextLine().toLowerCase()) {
                case "read":
                    System.out.println("which book would you like to read");
                    System.out.println("type 'sherlock' to read any sherlock holmes.");
                    System.out.println("type 'hero' to read any heroes of olympus.");
                    System.out.println("type 'potter' to read any Harry Potter.");
                    System.out.println("type 'sheldon' to read any Sidney Sheldon.");
                    System.out.println("type 'jackson' to read any Percy Jackson.");
                    System.out.println("type 'hit' to read Hit List.");
                    switch (scanner.nextLine().toLowerCase()) {
                        case "sherlock":
                            System.out.println("you picked out sherlock holmes");
                            openSherlockHolmes();
                            break;
                        case "hero":
                            System.out.println("you picked out heroes of Olympus");
                            openHeroesOfOlympus();
                            break;
                        case "potter":
                            System.out.println("you picked out harry potter");
                            openDeathlyHallows();
                            break;
                        case "sheldon":
                            System.out.println("you picked out Sidney Sheldon's The Sky is Falling");
                            openSkyIsFalling();
                            break;
                        case "jackson":
                            System.out.println("you picked out Percy Jackson-The Lightning Thief");
                            openPercyJackson();
                            break;
                        case "hit":
                            System.out.println("you picked out Hit List");
                            openHitList();
                            break;
                    }
                    break ;
                case "close":
                    break label;
                default:
                    System.out.println("input not recognised");
                    break ;
            }
        }
    }

    private static void openSherlockHolmes() {
        try{
            String url="http://www.google.com";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    private static void openHeroesOfOlympus() {
        try{
            String url="http://www.google.com";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    private static void openDeathlyHallows() {
        try{
            String url="http://www.google.com";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    private static void openSkyIsFalling() {
        try{
            String url="http://www.google.com";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    private static void openPercyJackson() {
        try{
            String url="http://www.google.com";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    private static void openHitList() {
        try{
            String url="http://www.google.com";
            String cmd = "cmd.exe /c start "+url;

            Runtime.getRuntime().exec(cmd);
        } catch (Exception ex){
            System.out.println("you don't have an internet connection");
        }
    }

    @Override
    public void printMap(int position) {
        BookShelf.position = position;
        Base.positionShelf=position;
        setHere(object,position);
        super.printMap(position);
    }
}
