package com.company.Objects;

import com.company.Base;
import com.company.You;

public class ShowCase extends Base {
    public static int position=-10;
    public String object = "ShowCase";
    public static String name = "a Show Case";
    public static boolean locked=true;
    public static boolean keysTaken;
    public static void openCase() {
        if (You.haveShowKeys) {
            System.out.println("you just opened the show case \n" +
                    "inside,you can see the skeleton of the legendary hell \n" +
                    "monster 'Kraken'.its smaller than you imagined\n" +
                    "Below you see a fossil of the impressions of some\n" +
                    "kind of a giant nail.");
            if (!keysTaken) {
                System.out.println("AND at the end you find another key with 'H' inscribed in it.\n" +
                        "you took it.");
                keysTaken=true;
                You.haveHellKeys=true;
            }
            System.out.println("you closed the closet");
        }else if(You.haveHellKeys){
            System.out.println("you tried the key but it didn't fit in it.");
        }else{
            System.out.println("you don't have the key to open the case");
        }
    }

    @Override
    public void printMap(int position) {
        this.position = position;
        Base.positionShowCase=position;
        setHere(object,position);
        super.printMap(position);
    }
}
